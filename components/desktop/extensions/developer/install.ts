// Стол разработчика — Epic 9, story 9.3.
//
// Виден только chairman'у кооператива-оператора каталога (`voskhod` на dev,
// определяется по флагу `is_operator_coop` в Vuex/Pinia store, который
// устанавливается через DesktopWorkspace.grants от controller'а).
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
          roles: ['chairman'],
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
              roles: ['chairman'],
            },
          },
          {
            path: 'publish',
            name: 'developer-publish-release',
            component: markRaw(DeveloperPublishReleasePage),
            meta: {
              title: 'Опубликовать релиз',
              icon: 'upload',
              roles: ['chairman'],
            },
          },
          {
            path: 'moderation',
            name: 'developer-moderation',
            component: markRaw(DeveloperModerationPage),
            meta: {
              title: 'Модерация',
              icon: 'fact_check',
              roles: ['chairman'],
            },
          },
          {
            path: 'publishers',
            name: 'developer-publishers',
            component: markRaw(DeveloperPublishersPage),
            meta: {
              title: 'Издатели',
              icon: 'key',
              roles: ['chairman'],
            },
          },
          {
            path: 'subscribers',
            name: 'developer-subscribers',
            component: markRaw(DeveloperSubscribersPage),
            meta: {
              title: 'Подписчики',
              icon: 'group',
              roles: ['chairman'],
            },
          },
          {
            path: 'pricing',
            name: 'developer-pricing',
            component: markRaw(DeveloperPricingPage),
            meta: {
              title: 'Pricing',
              icon: 'currency_ruble',
              roles: ['chairman'],
            },
          },
        ],
      },
    ],
  }];
}
