import { Injectable, Logger } from '@nestjs/common';
import type {
  IExtensionModule,
  IExtensionMetadata,
  IExtensionLoader,
  IExtensionLoaderResult,
} from '@coopenomics/interops';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Сервис динамической загрузки расширений.
 *
 * Обнаруживает пакеты @coopenomics/ext-* в node_modules,
 * загружает их и возвращает NestJS-модули для подключения к ядру.
 *
 * Расширение должно экспортировать default объект, реализующий IExtensionModule.
 */
@Injectable()
export class ExtensionLoaderService implements IExtensionLoader {
  private readonly logger = new Logger(ExtensionLoaderService.name);
  private readonly loadedExtensions: IExtensionLoaderResult[] = [];

  async discoverExtensions(): Promise<IExtensionLoaderResult[]> {
    this.loadedExtensions.length = 0;

    const externalExtensions = await this.discoverExternalExtensions();
    this.loadedExtensions.push(...externalExtensions);

    this.logger.log(
      `Обнаружено ${this.loadedExtensions.length} внешних расширений: ${this.loadedExtensions.map(e => e.metadata.name).join(', ') || 'нет'}`,
    );

    return this.loadedExtensions;
  }

  async loadExtension(packageName: string): Promise<IExtensionLoaderResult | null> {
    try {
      const mod = await this.tryRequire(packageName);
      if (!mod) return null;

      const extensionModule: IExtensionModule = mod.default || mod;

      if (!extensionModule.getMetadata || !extensionModule.getBackendModule) {
        this.logger.warn(`Пакет ${packageName} не реализует IExtensionModule — пропущен`);
        return null;
      }

      const metadata = extensionModule.getMetadata();
      const backendModule = extensionModule.getBackendModule();

      const result: IExtensionLoaderResult = {
        metadata,
        module: extensionModule,
        backendModule,
      };

      this.logger.log(`Загружено расширение: ${metadata.name}@${metadata.version}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Ошибка загрузки расширения ${packageName}: ${error.message}`);
      return null;
    }
  }

  getAvailableExtensions(): IExtensionMetadata[] {
    return this.loadedExtensions.map(e => e.metadata);
  }

  private async discoverExternalExtensions(): Promise<IExtensionLoaderResult[]> {
    const results: IExtensionLoaderResult[] = [];
    const scopeDir = this.findScopeDir();
    if (!scopeDir) return results;

    const entries = fs.readdirSync(scopeDir).filter(name => name.startsWith('ext-'));
    for (const entry of entries) {
      const packageName = `@coopenomics/${entry}`;
      const result = await this.loadExtension(packageName);
      if (result) results.push(result);
    }

    return results;
  }

  private findScopeDir(): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'node_modules', '@coopenomics'),
      path.resolve(__dirname, '../../../../node_modules/@coopenomics'),
      path.resolve(__dirname, '../../../../../../node_modules/@coopenomics'),
    ];

    for (const dir of candidates) {
      if (fs.existsSync(dir)) return dir;
    }

    return null;
  }

  private async tryRequire(packageName: string): Promise<any | null> {
    try {
      return require(packageName);
    } catch {
      return null;
    }
  }
}
