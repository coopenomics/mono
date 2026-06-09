// Стол разработчика — Epic 9, story 9.3.
//
// Виден только chairman'у кооператива-оператора каталога (`voskhod` на dev,
// определяется по флагу `is_operator_coop` в Vuex/Pinia store, который
// устанавливается через DesktopWorkspace.grants от controller'а).
//
// V1 содержание: 4 страницы-заглушки, описывающие, что разработчик мог
// бы сделать (мои пакеты, опубликовать релиз, подписчики, pricing). Все
// реальные действия идут REST'ом в ca-admin через chairman-token. На этом
// этапе UI-минимум, реальные mutation'ы — story 9.3.b.

import { markRaw } from 'vue';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { DeveloperMyPackagesPage } from './pages/DeveloperMyPackagesPage';
import { DeveloperPublishReleasePage } from './pages/DeveloperPublishReleasePage';
import { DeveloperSubscribersPage } from './pages/DeveloperSubscribersPage';
import { DeveloperPricingPage } from './pages/DeveloperPricingPage';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'developer',
    extension_name: 'developer',
    title: 'Стол разработчика',
    icon: 'fa-solid fa-code',
    defaultRoute: 'developer-my-packages',
    routes: [
      {
        meta: {
          title: 'Стол разработчика',
          icon: 'fa-solid fa-code',
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
              icon: 'fa-solid fa-box',
              roles: ['chairman'],
            },
          },
          {
            path: 'publish',
            name: 'developer-publish-release',
            component: markRaw(DeveloperPublishReleasePage),
            meta: {
              title: 'Опубликовать релиз',
              icon: 'fa-solid fa-upload',
              roles: ['chairman'],
            },
          },
          {
            path: 'subscribers',
            name: 'developer-subscribers',
            component: markRaw(DeveloperSubscribersPage),
            meta: {
              title: 'Подписчики',
              icon: 'fa-solid fa-users',
              roles: ['chairman'],
            },
          },
          {
            path: 'pricing',
            name: 'developer-pricing',
            component: markRaw(DeveloperPricingPage),
            meta: {
              title: 'Pricing',
              icon: 'fa-solid fa-rouble-sign',
              roles: ['chairman'],
            },
          },
        ],
      },
    ],
  }];
}
