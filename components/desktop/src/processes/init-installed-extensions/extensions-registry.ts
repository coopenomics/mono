import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';

// Импортируем все функции установки расширений
import capitalInstall from '../../../extensions/capital/install';
import chairmanInstall from '../../../extensions/chairman/install';
import chatcoopInstall from '../../../extensions/chatcoop/install';
import expensesInstall from '../../../extensions/expenses/install';
import participantInstall from '../../../extensions/participant/install';
import powerupInstall from '../../../extensions/powerup/install';
import sovietInstall from '../../../extensions/soviet/install';
import kuInstall from '../../../extensions/ku/install';
import reportsInstall from '../../../extensions/reports/install';
// Epic 9 story 9.3: «Стол разработчика» — виден только chairman'у
// кооператива-оператора каталога. Видимость регулируется meta.roles
// в install.ts и (V2) grants от controller'а через DesktopWorkspace.
import developerInstall from '../../../extensions/developer/install';
import publisherInstall from '../../../extensions/publisher/install';
import marketInstall from '../../../extensions/market/install';

/**
 * Единый регистр всех доступных расширений
 * Ключ - имя расширения, значение - функция установки
 */
export const extensionsRegistry: Record<string, () => Promise<IWorkspaceConfig[]>> = {
  capital: capitalInstall,
  chairman: chairmanInstall,
  chatcoop: chatcoopInstall,
  expenses: expensesInstall,
  participant: participantInstall,
  powerup: powerupInstall,
  soviet: sovietInstall,
  trustee: kuInstall,
  reports: reportsInstall,
  developer: developerInstall,
  publisher: publisherInstall,
  market: marketInstall,
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
