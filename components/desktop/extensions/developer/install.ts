// Стол разработчика — Epic 9, story 9.3.
//
// Виден по grant'у `Developer:manage`, который контроллер выдаёт председателю
// (DeveloperDesktopGrantsProvider, расширение `developer`). Стол издателя —
// отдельное расширение `publisher` («Мои приложения»).
//
// Страницы: мои пакеты, публикация пакета/релиза, модерация заявок
// (операторский approve восхода), подписчики, pricing. Все реальные
// действия идут GraphQL-мутациями apps-catalog-proxy controller'а,
// который проксирует их в ca-admin/ca-auth каталога.

import { markRaw } from 'vue';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { DeveloperMyPackagesPage } from './pages/DeveloperMyPackagesPage';
import { DeveloperPublishReleasePage } from './pages/DeveloperPublishReleasePage';
import { DeveloperModerationPage } from './pages/DeveloperModerationPage';
import { DeveloperSubscribersPage } from './pages/DeveloperSubscribersPage';
import { DeveloperPricingPage } from './pages/DeveloperPricingPage';
import { DeveloperPublishersPage } from './pages/DeveloperPublishersPage';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'developer',
    extension_name: 'developer',
    title: 'Стол разработчика',
    icon: 'code',
    defaultRoute: 'developer-my-packages',
    routes: [
      {
        meta: {
          title: 'Стол разработчика',
          icon: 'code',
          requires: 'Developer:manage',
        },
        path: '/:coopname/developer',
        name: 'developer',
        children: [
          {
            path: 'packages',
            name: 'developer-my-packages',
            component: markRaw(DeveloperMyPackagesPage),
            meta: {
              title: 'Мои пакеты',
              icon: 'inventory_2',
              requires: 'Developer:manage',
            },
          },
          {
            path: 'publish',
            name: 'developer-publish-release',
            component: markRaw(DeveloperPublishReleasePage),
            meta: {
              title: 'Опубликовать релиз',
              icon: 'upload',
              requires: 'Developer:manage',
            },
          },
          {
            path: 'moderation',
            name: 'developer-moderation',
            component: markRaw(DeveloperModerationPage),
            meta: {
              title: 'Модерация',
              icon: 'fact_check',
              requires: 'Developer:manage',
            },
          },
          {
            path: 'publishers',
            name: 'developer-publishers',
            component: markRaw(DeveloperPublishersPage),
            meta: {
              title: 'Издатели',
              icon: 'key',
              requires: 'Developer:manage',
            },
          },
          {
            path: 'subscribers',
            name: 'developer-subscribers',
            component: markRaw(DeveloperSubscribersPage),
            meta: {
              title: 'Подписчики',
              icon: 'group',
              requires: 'Developer:manage',
            },
          },
          {
            path: 'pricing',
            name: 'developer-pricing',
            component: markRaw(DeveloperPricingPage),
            meta: {
              title: 'Pricing',
              icon: 'currency_ruble',
              requires: 'Developer:manage',
            },
          },
        ],
      },
    ],
  }];
}
