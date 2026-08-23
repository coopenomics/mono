// Стол «Мои приложения» (487-27) — для пайщика, назначенного издателем.
//
// Виден только при grant'е `Publisher:manage`, который контроллер выдаёт
// аккаунтам из `apps_publishers` (см. DeveloperDesktopGrantsProvider).
// Издатель видит свои пакеты и сам выпускает/отзывает ключи каталога на них.

import { markRaw } from 'vue';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { PublisherMyAppsPage } from './pages/PublisherMyAppsPage';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'publisher',
    extension_name: 'developer',
    title: 'Мои приложения',
    icon: 'key',
    defaultRoute: 'publisher-my-apps',
    routes: [
      {
        meta: {
          title: 'Мои приложения',
          icon: 'key',
          requires: 'Publisher:manage',
        },
        path: '/:coopname/publisher',
        name: 'publisher',
        children: [
          {
            path: 'apps',
            name: 'publisher-my-apps',
            component: markRaw(PublisherMyAppsPage),
            meta: {
              title: 'Мои приложения',
              icon: 'key',
              requires: 'Publisher:manage',
            },
          },
        ],
      },
    ],
  }];
}
