// Стол разработчика — Epic 9, story 9.3.
//
// Виден по праву `Developer:manage`, которое контроллер выдаёт председателю
// (таблица прав DeveloperRights, расширение `developer`). Стол издателя —
// отдельное расширение `publisher` («Мои приложения»).
//
// Страницы: мои пакеты, публикация пакета/релиза, модерация заявок
// (операторский approve восхода), подписчики, pricing. Все реальные
// действия идут GraphQL-мутациями apps-catalog-proxy controller'а,
// который проксирует их в ca-admin/ca-auth каталога.

import './i18n';
import { markRaw } from 'vue';
import { t } from './i18n';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { DeveloperMyPackagesPage } from './pages/DeveloperMyPackagesPage';
import { DeveloperPublishReleasePage } from './pages/DeveloperPublishReleasePage';
import { DeveloperModerationPage } from './pages/DeveloperModerationPage';
import { DeveloperSubscribersPage } from './pages/DeveloperSubscribersPage';
import { DeveloperPricingPage } from './pages/DeveloperPricingPage';
import { DeveloperPublishersPage } from './pages/DeveloperPublishersPage';

/** Страницы стола: путь, имя маршрута, компонент, ключ заголовка, иконка. */
const PAGES = [
  { path: 'packages', name: 'developer-my-packages', component: DeveloperMyPackagesPage, title: 'developer.install.myPackages', icon: 'inventory_2' },
  { path: 'publish', name: 'developer-publish-release', component: DeveloperPublishReleasePage, title: 'developer.install.publishRelease', icon: 'upload' },
  { path: 'moderation', name: 'developer-moderation', component: DeveloperModerationPage, title: 'developer.install.moderation', icon: 'fact_check' },
  { path: 'publishers', name: 'developer-publishers', component: DeveloperPublishersPage, title: 'developer.install.publishers', icon: 'key' },
  { path: 'subscribers', name: 'developer-subscribers', component: DeveloperSubscribersPage, title: 'developer.install.subscribers', icon: 'group' },
  { path: 'pricing', name: 'developer-pricing', component: DeveloperPricingPage, title: 'developer.install.pricing', icon: 'currency_ruble' },
] as const;

const REQUIRES = 'Developer:manage';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'developer',
    extension_name: 'developer',
    title: t('developer.install.title'),
    icon: 'code',
    defaultRoute: 'developer-my-packages',
    routes: [
      {
        meta: { title: t('developer.install.title'), icon: 'code', requires: REQUIRES },
        path: '/:coopname/developer',
        name: 'developer',
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
