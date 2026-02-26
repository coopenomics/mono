import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';

// Импортируем все функции установки расширений
import capitalInstall from '../../../extensions/capital/install';
import chairmanInstall from '../../../extensions/chairman/install';
import chatcoopInstall from '../../../extensions/chatcoop/install';
import marketInstall from '../../../extensions/market/install';
import marketAdminInstall from '../../../extensions/market-admin/install';
import participantInstall from '../../../extensions/participant/install';
import powerupInstall from '../../../extensions/powerup/install';
import sovietInstall from '../../../extensions/soviet/install';
import reportsInstall from '../../../extensions/reports/install';

/**
 * Единый регистр всех доступных расширений
 * Ключ - имя расширения, значение - функция установки
 */
export const extensionsRegistry: Record<string, () => Promise<IWorkspaceConfig[]>> = {
  capital: capitalInstall,
  chairman: chairmanInstall,
  chatcoop: chatcoopInstall,
  market: marketInstall,
  'market-admin': marketAdminInstall,
  participant: participantInstall,
  powerup: powerupInstall,
  soviet: sovietInstall,
  reports: reportsInstall,
};

/**
 * Получить список всех доступных расширений
 */
export function getAvailableExtensions(): string[] {
  return Object.keys(extensionsRegistry);
}

/**
 * Проверить, существует ли расширение
 */
export function isExtensionAvailable(extensionName: string): boolean {
  return extensionName in extensionsRegistry;
}

/**
 * Получить функцию установки расширения
 */
export function getExtensionInstaller(extensionName: string): (() => Promise<IWorkspaceConfig[]>) | undefined {
  return extensionsRegistry[extensionName];
}
