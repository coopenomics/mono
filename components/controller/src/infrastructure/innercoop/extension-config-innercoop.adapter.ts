import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { IExtensionConfigPort } from '@coopenomics/innercoop';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';

/**
 * Реализация `IExtensionConfigPort`.
 *
 * Сервис расширений достаётся лениво через `ModuleRef`: он объявлен в
 * composition root, который сам зависит от расширений, — прямая инъекция
 * замкнула бы граф. Недоступность сервиса логируется один раз на процесс,
 * иначе лог зальётся при каждом обращении.
 */
@Injectable()
export class ExtensionConfigInnercoopAdapter implements IExtensionConfigPort {
  private readonly logger = new Logger(ExtensionConfigInnercoopAdapter.name);
  private resolved: ExtensionDomainService | null = null;
  private warned = false;

  constructor(private readonly moduleRef: ModuleRef) {}

  async get<T = Record<string, any>>(extensionName: string): Promise<T | null> {
    const service = this.service();
    if (!service) return null;
    const extension = await service.getAppByName(extensionName);
    return (extension?.config as T | undefined) ?? null;
  }

  private service(): ExtensionDomainService | null {
    if (this.resolved) return this.resolved;
    try {
      this.resolved = this.moduleRef.get(ExtensionDomainService, { strict: false });
    } catch {
      if (!this.warned) {
        this.warned = true;
        this.logger.error(
          'Сервис расширений недоступен: настройки расширений читаться не будут, ' +
            'поведение откатится на значения по умолчанию.'
        );
      }
      return null;
    }
    return this.resolved;
  }
}
