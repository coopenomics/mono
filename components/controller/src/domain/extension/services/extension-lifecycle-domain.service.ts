// domain/appstore/appstore-lifecycle-domain.service.ts

import { Injectable, type INestApplication } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';
import { ExtensionSchemaMigrationService } from './extension-schema-migration.service';
import { AppRegistry } from '~/extensions/extensions.registry';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  EXTENSION_APP_TERMINATE_EVENT,
  type ExtensionAppTerminatePayload,
} from '~/domain/extension/extension-app-lifecycle.events';
import {
  ONBOARDING_COMPLETED_EVENT,
  type OnboardingCompletedPayload,
} from '~/domain/onboarding/events/onboarding-completed.event';

@Injectable()
export class ExtensionLifecycleDomainService<TConfig = any> {
  private activeAppMap: { [key: string]: { appInstance: any } } = {};
  private appContext!: INestApplication;

  constructor(
    private readonly extensionDomainService: ExtensionDomainService<TConfig>,
    private readonly migrationService: ExtensionSchemaMigrationService,
    private readonly logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.setContext(ExtensionLifecycleDomainService.name);
  }

  setAppContext(appContext: INestApplication) {
    this.appContext = appContext;
  }

  async runApps() {
    const apps = await this.extensionDomainService.getAppList({ enabled: true });
    for (const appData of apps) {
      if (AppRegistry[appData.name]) {
        await this.runApp(appData.name);
      }
    }
  }

  async runApp(appName: string) {
    this.logger.info(`[RUN_APP] Начало запуска расширения ${appName}`);

    if (this.activeAppMap[appName]) {
      this.logger.debug(`[RUN_APP] Расширение ${appName} уже запущено, пропускаем`);
      return;
    }

    let appData = await this.extensionDomainService.getAppByName(appName);
    if (!appData) {
      this.logger.warn(`[RUN_APP] Расширение ${appName} не найдено в базе данных`);
      return;
    }

    if (!appData.enabled) {
      this.logger.info(`[RUN_APP] Расширение ${appName} отключено, пропускаем`);
      return;
    }

    this.logger.debug(
      `[RUN_APP] Расширение ${appName} найдено и включено. Текущая версия: ${(appData as any).schema_version || 1}`
    );
    // Применяем миграции схемы перед инициализацией
    const AppClass = AppRegistry[appName];
    if (AppClass) {
      this.logger.debug(`[RUN_APP] Запуск миграции схемы для расширения ${appName}`);

      if (AppClass.pluginClass) {
        const pluginInstance = this.appContext.get(AppClass.pluginClass);
        if (pluginInstance?.defaultConfig) {
          const migratedExtension = await this.migrationService.migrateAndUpdateExtension(
            appName,
            pluginInstance.defaultConfig,
            this.appContext
          );
          if (migratedExtension) {
            appData = migratedExtension;
          }
        }
      }

      const moduleInstance = this.appContext.get(AppClass.class); // Получаем инстанс модуля для инициализации

      await moduleInstance.initialize(appData.config); // Вызываем инициализацию модуля
      this.activeAppMap[appName] = { appInstance: moduleInstance }; // Сохраняем модуль как appInstance

      this.logger.info(`[RUN_APP] Расширение ${appName} успешно запущено`);
    } else {
      this.logger.warn(`[RUN_APP] Класс для расширения ${appName} не найден в AppRegistry`);
    }
  }

  async terminateApp(appName: string) {
    const appData = this.activeAppMap[appName];
    if (appData) {
      this.eventEmitter.emit(EXTENSION_APP_TERMINATE_EVENT, { appName } satisfies ExtensionAppTerminatePayload);
      delete this.activeAppMap[appName];
      this.logger.info(`Расширение ${appName} остановлено.`);
    } else {
      this.logger.info(`Расширение ${appName} не найдено.`);
    }
  }

  async restartApp(appName: string) {
    await this.terminateApp(appName);
    await this.runApp(appName);
    this.logger.info(`Расширение ${appName} перезапущено.`);
  }

  /**
   * Авто-перезапуск расширения после завершения его L1-онбординга.
   *
   * Логика — раздел 7.1 плана C28-10 (вариант (в) auto-restart): сервис
   * онбординга расширения эмиттит ONBOARDING_COMPLETED_EVENT, когда все
   * _done флаги в extension.config встали; lifecycle ловит и перезапускает
   * расширение, чтобы initialize(config) увидел актуальный config и
   * перерегистрировал оферты/программы в AgreementRegistryService.
   *
   * Совет ничего не нажимает.
   */
  @OnEvent(ONBOARDING_COMPLETED_EVENT)
  async onOnboardingCompleted(payload: OnboardingCompletedPayload) {
    const { extension_name } = payload;
    this.logger.info(
      `[ONBOARDING_COMPLETED] получено событие для ${extension_name}, инициирую restartApp`
    );
    try {
      await this.restartApp(extension_name);
    } catch (error) {
      this.logger.error(
        `[ONBOARDING_COMPLETED] restartApp(${extension_name}) упал: ${(error as Error).message}`,
        (error as Error).stack
      );
    }
  }
}
