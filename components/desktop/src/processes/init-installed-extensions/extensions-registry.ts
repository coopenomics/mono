import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';

// Core extensions (всегда встроены)
import chairmanInstall from '../../../extensions/chairman/install';
import chatcoopInstall from '../../../extensions/chatcoop/install';
import marketInstall from '../../../extensions/market/install';
import marketAdminInstall from '../../../extensions/market-admin/install';
import participantInstall from '../../../extensions/participant/install';
import powerupInstall from '../../../extensions/powerup/install';
import sovietInstall from '../../../extensions/soviet/install';
import reportsInstall from '../../../extensions/reports/install';

/**
 * Единый регистр всех доступных расширений.
 * Core-расширения регистрируются статически.
 * Внешние (@coopenomics/ext-*) — динамически через tryLoadExtension.
 */
export const extensionsRegistry: Record<string, () => Promise<IWorkspaceConfig[]>> = {
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
 * Попытка загрузить расширение capital.
 * Ищет: 1) встроенный файл, 2) пакет @coopenomics/ext-capital
 */
function tryLoadCapitalInstall(): (() => Promise<IWorkspaceConfig[]>) | null {
  try {
    const mod = require('../../../extensions/capital/install');
    return mod.default || mod;
  } catch {
    // встроенный capital не найден
  }
  return null;
}

const capitalInstall = tryLoadCapitalInstall();
if (capitalInstall) {
  extensionsRegistry['capital'] = capitalInstall;
}

export function getAvailableExtensions(): string[] {
  return Object.keys(extensionsRegistry);
}

export function isExtensionAvailable(extensionName: string): boolean {
  return extensionName in extensionsRegistry;
}

export function getExtensionInstaller(extensionName: string): (() => Promise<IWorkspaceConfig[]>) | undefined {
  return extensionsRegistry[extensionName];
}
