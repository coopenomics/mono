// domain/appstore/interactors/app.interactor.ts

import { Injectable } from '@nestjs/common';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';
import { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { ExtensionLifecycleDomainService } from '~/domain/extension/services/extension-lifecycle-domain.service';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

@Injectable()
export class ExtensionInteractor<TConfig = any> {
  constructor(
    private readonly extensionDomainService: ExtensionDomainService<TConfig>,
    private readonly appLifecycleService: ExtensionLifecycleDomainService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ExtensionInteractor.name);
  }

  async runApps() {
    await this.appLifecycleService.runApps();
  }

  async runApp(name: string) {
    await this.appLifecycleService.runApp(name);
  }

  async restartApp(appName: string) {
    await this.appLifecycleService.restartApp(appName);
  }

  async terminateApp(appName: string) {
    await this.appLifecycleService.terminateApp(appName);
  }

  // Получение списка всех приложений
  async getAppList(filter?: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>[]> {
    return this.extensionDomainService.getAppList(filter);
  }

  async getApp(name: string): Promise<ExtensionDomainEntity<TConfig> | null> {
    return this.extensionDomainService.getAppByName(name);
  }

  async updateApp(appData: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    const app = await this.extensionDomainService.updateApp(appData);
    if (app.enabled == false) await this.terminateApp(app.name);
    else this.restartApp(appData.name as string);

    return app;
  }

  // Установка нового приложения с atomic-rollback при провале runApp.
  // Если запись об этом расширении уже существовала до вызова install,
  // rollback не сносит её — ограничиваемся пробросом исключения.
  async installApp(appData: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    const preExisting = appData.name
      ? await this.extensionDomainService.getAppByName(appData.name as string)
      : null;

    const app = await this.extensionDomainService.installApp(appData);

    if (appData.enabled) {
      try {
        await this.runApp(app.name);
      } catch (error) {
        this.logger.error(
          `[INSTALL_APP] Расширение ${app.name} провалилось на runApp — откатываю установку`,
          error instanceof Error ? error.stack : String(error)
        );
        if (!preExisting) {
          try {
            await this.uninstallApp({ name: app.name });
          } catch (rollbackError) {
            this.logger.error(
              `[INSTALL_APP] Rollback uninstallApp(${app.name}) тоже провалился`,
              rollbackError instanceof Error ? rollbackError.stack : String(rollbackError)
            );
          }
        }
        throw error;
      }
    }

    return app;
  }

  // Установка нового приложения
  async uninstallApp(appData: Partial<ExtensionDomainEntity<TConfig>>): Promise<boolean> {
    if (!appData.name) throw new Error('Имя у приложения должно быть задано');

    // удаление приложения
    const result = await this.extensionDomainService.uninstallApp(appData);

    if (result) await this.terminateApp(appData.name as string);

    return result;
  }

  async installDefaultApps(): Promise<void> {
    const defaultApps = this.extensionDomainService.getDefaultApps();

    for (const app of defaultApps) {
      if (!app.name) throw new Error('Имя у приложения должно быть задано');
      const a = await this.extensionDomainService.getAppByName(app.name);
      if (!a) await this.extensionDomainService.installApp(app);
    }
  }
}
