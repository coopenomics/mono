import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';

// Импортируем все функции установки расширений
import capitalInstall from '../../../extensions/capital/install';
import cashierInstall from '../../../extensions/cashier/install';
import chairmanInstall from '../../../extensions/chairman/install';
// Стол «Приложения» (26.10.2026): каталог, установленные, подписки и подключение.
import appsInstall from '../../../extensions/apps/install';
import chatcoopInstall from '../../../extensions/chatcoop/install';
import expensesInstall from '../../../extensions/expenses/install';
import participantInstall from '../../../extensions/participant/install';
import powerupInstall from '../../../extensions/powerup/install';
import sovietInstall from '../../../extensions/soviet/install';
import kuInstall from '../../../extensions/ku/install';
import reportsInstall from '../../../extensions/reports/install';
// Расширение `developer` даёт два стола: «Стол разработчика» пайщика-издателя
// и «Стол администратора» каталога. Видимость страниц регулируют права от
// ядра (meta.requires в install.ts).
import developerInstall from '../../../extensions/developer/install';
import appsAdminInstall from '../../../extensions/developer/admin/install';
import marketInstall from '../../../extensions/market/install';
import edubridgeInstall from '../../../extensions/edubridge/install';
import robotInstall from '../../../extensions/robot/install';
import greetingsInstall from '../../../extensions/greetings/install';

/**
 * Единый регистр всех доступных расширений
 * Ключ - имя расширения, значение - функция установки
 */
export const extensionsRegistry: Record<string, () => Promise<IWorkspaceConfig[]>> = {
  capital: capitalInstall,
  cashier: cashierInstall,
  chairman: chairmanInstall,
  apps: appsInstall,
  chatcoop: chatcoopInstall,
  expenses: expensesInstall,
  participant: participantInstall,
  powerup: powerupInstall,
  soviet: sovietInstall,
  trustee: kuInstall,
  reports: reportsInstall,
  developer: developerInstall,
  appsadmin: appsAdminInstall,
  market: marketInstall,
  edubridge: edubridgeInstall,
  robot: robotInstall,
  greetings: greetingsInstall,
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
