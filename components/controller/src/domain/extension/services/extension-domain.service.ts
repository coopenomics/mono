// domain/appstore/services/appstore-domain.service.ts

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { EXTENSION_REPOSITORY, ExtensionDomainRepository, ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { AppRegistry } from '~/extensions/extensions.registry';
import { defaultConfig as builtinDefaultConfig } from '~/extensions/builtin/builtin-extension.module';

@Injectable()
export class ExtensionDomainService<TConfig = any> {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionDomainRepository: ExtensionDomainRepository<TConfig> // Используем токен для инъекции зависимости
  ) {}

  async getAppList(filter?: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>[]> {
    return this.extensionDomainRepository.find(filter);
  }

  async getAppByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null> {
    return this.extensionDomainRepository.findByName(name);
  }

  async updateApp(appData: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    if (!appData.name) {
      throw new BadRequestException('Application name is required');
    }

    return await this.extensionDomainRepository.update(appData);
  }

  async installApp(appData: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    if (!appData.name) {
      throw new BadRequestException('Application name is required');
    }

    const existingApp = await this.getAppByName(appData.name);

    if (existingApp) {
      throw new Error('Application is already installed.');
    }

    return this.extensionDomainRepository.create(appData);
  }

  async uninstallApp(appData: Partial<ExtensionDomainEntity<TConfig>>): Promise<boolean> {
    if (!appData.name) {
      throw new BadRequestException('Application name is required');
    }

    return this.extensionDomainRepository.deleteByName(appData.name);
  }

  /**
   * Расширения, которые новый кооператив получает сразу.
   *
   * Состав и дефолты конфига объявляет каждое расширение записью в реестре:
   * ядру незачем знать, из чего состоит чужой конфиг. Раньше этот список
   * держал сам сервис и импортировал дефолты шести расширений напрямую.
   */
  getDefaultApps(): Partial<ExtensionDomainEntity>[] {
    const fromRegistry = Object.entries(AppRegistry)
      .filter(([, extension]) => extension.defaults)
      .map(([name, extension]) => ({
        name,
        enabled: extension.defaults!.enabled,
        config: extension.defaults!.config,
      }));

    return [
      ...fromRegistry,
      // Стол вкладчика записи в реестре не имеет, но ставится с самого начала
      // и присутствует у всех действующих кооперативов. Убрать его отсюда —
      // значит расстроить установленный состав на ровном месте; вернуть в
      // реестр — отдельное решение о том, что это за стол сегодня.
      { name: 'contributor', enabled: true, config: builtinDefaultConfig },
    ];
  }
}
