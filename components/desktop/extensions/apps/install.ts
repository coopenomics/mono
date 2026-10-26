// Стол «Приложения» (26.10.2026): приложение, которое управляет другими
// приложениями, поставляется как они — отдельным расширением, а не разделами
// в столах председателя и пайщика.
//
// Что в нём живёт:
//  - каталог: встроенные расширения и приложения из каталога одной витриной,
//    страница приложения с описанием, подпиской, настройками и включением;
//  - установленные приложения;
//  - подписки и кошелёк кооператива у провайдера подключения — для чтения
//    председателем и советом (право `Apps:read`), действия — председателю
//    (`Apps:manage`);
//  - на узле оператора — подключение кооператива-пайщика: счёт, подписки,
//    списания, узел (право `Connection:read:own`; видно только аккаунту
//    кооператива, данные отдают резолверы ядра).
//
// Имена маршрутов сохранены от прежних мест (`extstore-showcase`,
// `one-extension`, `connect`): на них ссылаются кнопки установки и
// сценарии проверки.

import './i18n';
import { markRaw } from 'vue';
import { t } from './i18n';
import type { IWorkspaceConfig, IWorkspaceRoute } from 'src/shared/lib/types/workspace';
import { ExtensionsShowcase } from 'src/pages/ExtensionStore/ExtensionsShowcase';
import { InstalledExtensions } from 'src/pages/ExtensionStore/InstalledExtensions';
import { ExtensionPage } from 'src/pages/ExtensionStore/ExtensionPage';
import { ExtensionsManagement } from 'src/pages/ExtensionStore/ExtensionsManagement';
import { NodeSubscriptionsPage } from 'src/pages/ExtensionStore/NodeSubscriptions';
import {
  ConnectionAgreementPage,
  ConnectionNodePage,
  ConnectionOverviewPage,
  ConnectionPaymentsPage,
  ConnectionSubscriptionsPage,
  InstallationCompletedPage,
} from 'src/pages/Union/ConnectionAgreement';

const READ = 'Apps:read';
const MANAGE = 'Apps:manage';
const CONNECTION = 'Connection:read:own';
// Подключение ведёт оператор: страницы видит только аккаунт кооператива на узле оператора.
const CONNECTION_CONDITION = 'isCoop === true && coopname === "voskhod"';

/** Страница приложения: описание, подписка или установка, настройки. Скрыта из меню, подсвечивает каталог. */
function appPageRoute(): IWorkspaceRoute {
  const hidden = { requiresAuth: true, hidden: true, menuKey: 'extstore-showcase' };
  return {
    path: 'app/:name',
    name: 'one-extension',
    component: markRaw(ExtensionPage),
    meta: { title: t('apps.install.appTitle'), requires: READ, ...hidden },
    children: [
      {
        path: 'settings',
        name: 'extension-settings',
        component: markRaw(ExtensionPage),
        meta: { title: t('apps.install.appSettingsTitle'), requires: MANAGE, ...hidden },
      },
      {
        path: 'install',
        name: 'extension-install',
        component: markRaw(ExtensionPage),
        meta: { title: t('apps.install.appInstallTitle'), requires: MANAGE, ...hidden },
      },
    ],
  };
}

/** Подключение кооператива-пайщика у оператора: вкладки счёта, подписок, списаний и узла. */
function connectionRoute(): IWorkspaceRoute {
  const tab = (path: string, name: string, title: string, icon: string, component: unknown): IWorkspaceRoute => ({
    path,
    name,
    component: markRaw(component as object),
    meta: { title, icon, requires: CONNECTION, conditions: CONNECTION_CONDITION, requiresAuth: true, hidden: true, menuKey: 'connect' },
  });
  return {
    meta: {
      title: t('apps.install.connectionTitle'),
      icon: 'link',
      requires: CONNECTION,
      conditions: CONNECTION_CONDITION,
      requiresAuth: true,
    },
    path: '/:coopname/connect',
    name: 'connect',
    component: markRaw(ConnectionAgreementPage),
    children: [
      tab('overview', 'connect-overview', t('apps.install.connectionOverviewTitle'), 'account_balance_wallet', ConnectionOverviewPage),
      tab('subscriptions', 'connect-subscriptions', t('apps.install.connectionSubscriptionsTitle'), 'receipt_long', ConnectionSubscriptionsPage),
      tab('payments', 'connect-payments', t('apps.install.connectionPaymentsTitle'), 'history', ConnectionPaymentsPage),
      tab('node', 'connect-node', t('apps.install.connectionNodeTitle'), 'dns', ConnectionNodePage),
      tab('completed', 'installation-completed', t('apps.install.installationCompletedTitle'), 'check_circle', InstallationCompletedPage),
    ],
  };
}

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'apps',
    extension_name: 'apps',
    title: t('apps.install.title'),
    icon: 'apps',
    defaultRoute: 'extstore-showcase',
    routes: [
      {
        meta: { title: t('apps.install.title'), icon: 'apps', requires: READ, requiresAuth: true },
        path: '/:coopname/apps',
        name: 'apps',
        component: markRaw(ExtensionsManagement),
        redirect: { name: 'extstore-showcase' },
        children: [
          {
            path: 'catalog',
            name: 'extstore-showcase',
            component: markRaw(ExtensionsShowcase),
            meta: { title: t('apps.install.catalogTitle'), icon: 'storefront', requires: READ, requiresAuth: true },
          },
          {
            path: 'installed',
            name: 'appstore-installed',
            component: markRaw(InstalledExtensions),
            meta: { title: t('apps.install.installedTitle'), icon: 'check_circle', requires: READ, requiresAuth: true },
          },
          {
            path: 'subscriptions',
            name: 'apps-subscriptions',
            component: markRaw(NodeSubscriptionsPage),
            meta: { title: t('apps.install.subscriptionsTitle'), icon: 'receipt_long', requires: READ, requiresAuth: true },
          },
          appPageRoute(),
          connectionRoute(),
        ],
      },
    ],
  }];
}
