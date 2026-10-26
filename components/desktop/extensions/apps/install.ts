// Стол «Приложения» (26.10.2026): приложение, которое управляет другими
// приложениями, поставляется как они — отдельным расширением, а не разделом
// в столе председателя.
//
// Что в нём живёт:
//  - каталог: встроенные расширения и приложения из каталога одной витриной,
//    страница приложения с описанием, подпиской, настройками и включением;
//  - установленные приложения;
//  - подписки и кошелёк кооператива у провайдера подключения — для чтения
//    председателем и советом (право `Apps:read`), действия — председателю
//    (`Apps:manage`).
//
// Подключение кооператива у оператора здесь не живёт: оно на столе пайщика
// у оператора, где кооператив-пайщик его и ищет (решение владельца 26.10.2026).
//
// Имена маршрутов сохранены от прежнего места (`extstore-showcase`,
// `one-extension`): на них ссылаются кнопки установки.

import './i18n';
import { markRaw } from 'vue';
import { t } from './i18n';
import type { IWorkspaceConfig, IWorkspaceRoute } from 'src/shared/lib/types/workspace';
import { ExtensionsShowcase } from 'src/pages/ExtensionStore/ExtensionsShowcase';
import { InstalledExtensions } from 'src/pages/ExtensionStore/InstalledExtensions';
import { ExtensionPage } from 'src/pages/ExtensionStore/ExtensionPage';
import { ExtensionsManagement } from 'src/pages/ExtensionStore/ExtensionsManagement';
import { NodeSubscriptionsPage } from 'src/pages/ExtensionStore/NodeSubscriptions';

const READ = 'Apps:read';
const MANAGE = 'Apps:manage';

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
        ],
      },
    ],
  }];
}
