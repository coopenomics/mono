// «Стол администратора» каталога приложений — второй стол расширения `developer`.
//
// Виден по праву `Developer:manage`, которое ядро выдаёт председателю.
// Страницы: модерация выпусков (права ядра версии, цена издателя, решение) и
// все пакеты кооператива с издателями и ценами. Цену администратор видит, но
// не меняет: её назначает издатель пакета на «Столе разработчика».

import '../i18n';
import { markRaw } from 'vue';
import { t } from '../i18n';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { DeveloperModerationPage } from '../pages/DeveloperModerationPage';
import { AdminPackagesPage } from '../pages/AdminPackagesPage';

/** Страницы стола: путь, имя маршрута, компонент, ключ заголовка, иконка. */
const PAGES = [
  { path: 'moderation', name: 'appsadmin-moderation', component: DeveloperModerationPage, title: 'developer.install.moderation', icon: 'fact_check' },
  { path: 'packages', name: 'appsadmin-packages', component: AdminPackagesPage, title: 'developer.install.adminPackages', icon: 'inventory_2' },
] as const;

const REQUIRES = 'Developer:manage';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'appsadmin',
    extension_name: 'developer',
    title: t('developer.install.adminTitle'),
    icon: 'admin_panel_settings',
    defaultRoute: 'appsadmin-moderation',
    routes: [
      {
        meta: { title: t('developer.install.adminTitle'), icon: 'admin_panel_settings', requires: REQUIRES },
        path: '/:coopname/appsadmin',
        name: 'appsadmin',
        children: PAGES.map((page) => ({
          path: page.path,
          name: page.name,
          component: markRaw(page.component),
          meta: { title: t(page.title), icon: page.icon, requires: REQUIRES },
        })),
      },
    ],
  }];
}
