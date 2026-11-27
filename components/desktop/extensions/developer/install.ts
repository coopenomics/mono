// «Стол разработчика» — стол пайщика-издателя приложений каталога.
//
// Виден по праву `Publisher:manage`, которое ядро выдаёт каждому принятому
// пайщику (таблица прав DeveloperRights, расширение `developer`): издателем
// становится любой пайщик, зарегистрировав пакет на странице «Мои пакеты».
// Ключи API для команды выпуска — отдельная страница (487-37): ключ действует
// на отмеченные пакеты либо на все пакеты издателя. Выпуск версии идёт из
// терминала набором издателя — третья страница стола даёт инструкцию. Стол
// администратора каталога — `admin/install.ts`.

import './i18n';
import { markRaw } from 'vue';
import { t } from './i18n';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { DeveloperMyPackagesPage } from './pages/DeveloperMyPackagesPage';
import { DeveloperApiKeysPage } from './pages/DeveloperApiKeysPage';
import { DeveloperReleaseGuidePage } from './pages/DeveloperReleaseGuidePage';

/** Страницы стола: путь, имя маршрута, компонент, ключ заголовка, иконка. */
const PAGES = [
  { path: 'packages', name: 'developer-my-packages', component: DeveloperMyPackagesPage, title: 'developer.install.myPackages', icon: 'inventory_2' },
  { path: 'api-keys', name: 'developer-api-keys', component: DeveloperApiKeysPage, title: 'developer.install.apiKeys', icon: 'key' },
  { path: 'release-guide', name: 'developer-release-guide', component: DeveloperReleaseGuidePage, title: 'developer.install.releaseGuide', icon: 'terminal' },
] as const;

const REQUIRES = 'Publisher:manage';

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
