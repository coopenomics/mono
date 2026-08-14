// domain/appstore/appstore-lifecycle-domain.service.ts

import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';
import { ExtensionSchemaMigrationService } from './extension-schema-migration.service';
import { AppRegistry } from '~/extensions/extensions.registry';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  EXTENSION_APP_TERMINATE_EVENT,
  type ExtensionAppTerminatePayload,
} from '@coopenomics/extension-kit';
import {
  ONBOARDING_COMPLETED_EVENT,
  type OnboardingCompletedPayload,
} from '~/domain/onboarding/events/onboarding-completed.event';

@Injectable()
export class ExtensionLifecycleDomainService<TConfig = any> {
  private activeAppMap: { [key: string]: { appInstance: any } } = {};

  constructor(
    private readonly extensionDomainService: ExtensionDomainService<TConfig>,
    private readonly migrationService: ExtensionSchemaMigrationService,
    private readonly logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
    // Провайдеры расширений резолвятся через ModuleRef, а не через ссылку на
    // само приложение из `~/index`: та ссылка делала домен зависимым от точки
    // входа — модуль ядра импортировал файл, который его же и запускает.
    private readonly moduleRef: ModuleRef
  ) {
    this.logger.setContext(ExtensionLifecycleDomainService.name);
  }

  /** Резолвер провайдеров для миграций расширения: тот же DI, вид попроще. */
  private get dependencyResolver() {
    return {
      get: <T,>(token: string | symbol | (new (...args: any[]) => any)): T =>
        this.moduleRef.get(token as never, { strict: false }),
    };
  }

  /**
   * Сверить capability-заявку расширения с тем, что контур действительно даёт.
   *
   * Заявка отвечает на вопрос «что этому расширению позволено просить», а не
   * «что позволено пайщику» — права пайщика проверяет само расширение на
   * границе своего API. Проверка делается один раз, при запуске: без
   * обязательного порта расширение всё равно упадёт, но упадёт позже, в
   * середине пользовательского сценария и с невнятной ошибкой DI.
   */
  private async assertRequestedPortsAvailable(
    appName: string,
    ports?: { required: ReadonlyArray<symbol>; optional: ReadonlyArray<symbol> }
  ): Promise<void> {
    if (!ports) return;

    const missing: string[] = [];
    for (const token of ports.required) {
      if (!(await this.isPortProvided(token))) {
        missing.push(token.description ?? String(token));
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Расширение ${appName} не запускается: контур не предоставляет заявленные порты — ${missing.join(', ')}. ` +
          'Либо порт не привязан в InnercoopBridgeModule, либо расширение просит то, чего в этом кооперативе нет.'
      );
    }

    for (const token of ports.optional) {
      if (!(await this.isPortProvided(token))) {
        this.logger.warn(
          `[RUN_APP] Расширение ${appName}: необязательный порт ${token.description ?? String(token)} ` +
            'не предоставлен — связанные с ним возможности выключены'
        );
      }
    }
  }

  /**
   * Есть ли у порта реализация в этом контуре.
   *
   * Двумя способами намеренно: `get` не умеет провайдеров с областью видимости
   * (логгер объявлен транзиентным, потому что `setContext` мутирует инстанс),
   * а `resolve` создаёт экземпляр и потому дороже. Порт, доступный любым из
   * двух, — предоставлен.
   */
  private async isPortProvided(token: symbol): Promise<boolean> {
    try {
      this.moduleRef.get(token as never, { strict: false });
      return true;
    } catch {
      try {
        await this.moduleRef.resolve(token as never, undefined, { strict: false });
        return true;
      } catch {
        return false;
      }
    }
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
      await this.assertRequestedPortsAvailable(appName, AppClass.ports);

      this.logger.debug(`[RUN_APP] Запуск миграции схемы для расширения ${appName}`);

      if (AppClass.extensionClass) {
        const extensionInstance = this.moduleRef.get(AppClass.extensionClass, { strict: false });
        if (extensionInstance?.defaultConfig) {
          const migratedExtension = await this.migrationService.migrateAndUpdateExtension(
            appName,
            extensionInstance.defaultConfig,
            this.dependencyResolver
          );
          if (migratedExtension) {
            appData = migratedExtension;
          }
        }
      }

      const moduleInstance = this.moduleRef.get(AppClass.class, { strict: false }); // Получаем инстанс модуля для инициализации

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
