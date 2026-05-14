// domain/appstore/services/appstore-domain.service.ts

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { EXTENSION_REPOSITORY, ExtensionDomainRepository } from '../repositories/extension-domain.repository';
import { ExtensionDomainEntity } from '../entities/extension-domain.entity';
import { defaultConfig as chairmanDefaultConfig } from '~/extensions/chairman/chairman-extension.module';
import { defaultConfig as powerupDefaultConfig } from '~/extensions/powerup/powerup-extension.module';
import { defaultConfig as qrpayDefaultConfig } from '~/extensions/qrpay/qrpay-extension.module';
import { defaultConfig as builtinDefaultConfig } from '~/extensions/builtin/builtin-extension.module';
import { defaultConfig as yookassaDefaultConfig } from '~/extensions/yookassa/yookassa-extension.module';
import { defaultConfig as sberpollDefaultConfig } from '~/extensions/sberpoll/sberpoll-extension.module';

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

  getDefaultApps(): Partial<ExtensionDomainEntity>[] {
    return [
      {
        name: 'powerup',
        enabled: true,
        config: powerupDefaultConfig,
      },
      {
        name: 'qrpay',
        enabled: true,
        config: qrpayDefaultConfig,
      },
      {
        name: 'chairman',
        enabled: true,
        config: chairmanDefaultConfig,
      },
      {
        name: 'soviet',
        enabled: true,
        config: builtinDefaultConfig,
      },
      {
        name: 'participant',
        enabled: true,
        config: builtinDefaultConfig,
      },
      {
        name: 'contributor',
        enabled: true,
        config: builtinDefaultConfig,
      },
      {
        name: 'reports',
        enabled: true,
        config: builtinDefaultConfig,
      },
      {
        name: 'yookassa',
        enabled: false,
        config: yookassaDefaultConfig,
      },
      {
        name: 'sberpoll',
        enabled: false,
        config: sberpollDefaultConfig,
      },
    ];
  }
}
