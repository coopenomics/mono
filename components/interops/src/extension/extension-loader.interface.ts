/**
 * Контракт загрузчика расширений.
 * Ядро реализует этот интерфейс для обнаружения и загрузки расширений.
 */

import type { IExtensionModule, IExtensionMetadata } from './extension-module.interface';

export interface IExtensionLoaderResult {
  metadata: IExtensionMetadata;
  module: IExtensionModule;
  backendModule: any;
}

export interface IExtensionLoader {
  /**
   * Обнаружить все установленные расширения.
   * Сканирует node_modules/@coopenomics/ext-* и встроенные расширения.
   */
  discoverExtensions(): Promise<IExtensionLoaderResult[]>;

  /**
   * Загрузить конкретное расширение по имени пакета.
   */
  loadExtension(packageName: string): Promise<IExtensionLoaderResult | null>;

  /**
   * Получить список метаданных всех обнаруженных расширений.
   */
  getAvailableExtensions(): IExtensionMetadata[];
}
