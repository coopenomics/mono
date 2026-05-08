import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import {
  OperationsPage,
  PostingsPage,
  WalletsPage,
  CoopWalletsPage,
  ParticipantWalletsPage,
  AccountsPage,
  DocumentsPage,
  DocumentsCalendarPage,
  DocumentsFormsPage,
  DocumentsArchivePage,
  SettingsPage,
} from './pages';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'reports',
    extension_name: 'reports',
    title: 'Стол бухгалтера',
    icon: 'fa-solid fa-file-invoice',
    defaultRoute: 'reports-operations',
    routes: [
      {
        meta: {
          title: 'Стол бухгалтера',
          icon: 'fa-solid fa-file-invoice',
          roles: ['chairman'],
        },
        path: '/:coopname/reports',
        name: 'reports',
        children: [
          {
            path: 'operations',
            name: 'reports-operations',
            component: markRaw(OperationsPage),
            meta: {
              title: 'Реестр операций',
              icon: 'fa-solid fa-list-ul',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'postings',
            name: 'reports-postings',
            component: markRaw(PostingsPage),
            meta: {
              title: 'Реестр проводок',
              icon: 'fa-solid fa-arrows-split-up-and-left',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'wallets',
            name: 'reports-wallets',
            component: markRaw(WalletsPage),
            meta: {
              title: 'Реестр кошельков',
              icon: 'fa-solid fa-wallet',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            // shell-страница: injects 2 header buttons, рендерит <router-view>.
            // При заходе на /reports/wallets делаем redirect на ...-coop.
            redirect: { name: 'reports-wallets-coop' },
            children: [
              {
                path: 'coop',
                name: 'reports-wallets-coop',
                component: markRaw(CoopWalletsPage),
                meta: {
                  title: 'Кооператив',
                  icon: 'fa-solid fa-building',
                  roles: ['chairman'],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'participants',
                name: 'reports-wallets-participants',
                component: markRaw(ParticipantWalletsPage),
                meta: {
                  title: 'Пайщики',
                  icon: 'fa-solid fa-users',
                  roles: ['chairman'],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
            ],
          },
          {
            path: 'accounts',
            name: 'reports-accounts',
            component: markRaw(AccountsPage),
            meta: {
              title: 'Реестр счетов',
              icon: 'fa-solid fa-sitemap',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'documents',
            name: 'reports-documents',
            component: markRaw(DocumentsPage),
            meta: {
              title: 'Отчётность',
              icon: 'fa-solid fa-file-invoice',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            // shell-страница: injects 3 header buttons, рендерит <router-view>.
            // При заходе на /reports/documents делаем redirect на ...-calendar.
            redirect: { name: 'reports-documents-calendar' },
            children: [
              {
                path: 'calendar',
                name: 'reports-documents-calendar',
                component: markRaw(DocumentsCalendarPage),
                meta: {
                  title: 'Календарь',
                  icon: 'fa-solid fa-calendar-days',
                  roles: ['chairman'],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'forms',
                name: 'reports-documents-forms',
                component: markRaw(DocumentsFormsPage),
                meta: {
                  title: 'Список форм',
                  icon: 'fa-solid fa-list',
                  roles: ['chairman'],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'archive',
                name: 'reports-documents-archive',
                component: markRaw(DocumentsArchivePage),
                meta: {
                  title: 'Архив',
                  icon: 'fa-solid fa-box-archive',
                  roles: ['chairman'],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
            ],
          },
          {
            path: 'settings',
            name: 'reports-settings',
            component: markRaw(SettingsPage),
            meta: {
              title: 'Реквизиты',
              icon: 'fa-solid fa-gear',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
        ],
      },
    ],
  }];
}
