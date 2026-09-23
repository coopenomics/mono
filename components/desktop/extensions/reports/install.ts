import './i18n';
import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import {
  OperationsPage,
  PostingsPage,
  ProcessesPage,
  WalletsPage,
  CoopWalletsPage,
  ParticipantWalletsPage,
  AccountsPage,
  DocumentsPage,
  DocumentsCalendarPage,
  DocumentsFormsPage,
  DocumentsArchivePage,
  NdflPage,
  SettingsPage,
} from './pages';
import { t } from './i18n';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'reports',
    extension_name: 'reports',
    title: t('reports.install.title'),
    icon: 'fa-solid fa-file-invoice',
    defaultRoute: 'reports-processes',
    routes: [
      {
        meta: {
          title: t('reports.install.title'),
          icon: 'fa-solid fa-file-invoice',
          roles: ['chairman'],
        },
        path: '/:coopname/reports',
        name: 'reports',
        children: [
          {
            // Реестр процессов главенствует над операциями/проводками: он
            // агрегирует документы + операции + проводки одного процесса по
            // его хэшу, остальные реестры — срезы. Поэтому он первым в столе.
            path: 'processes',
            name: 'reports-processes',
            component: markRaw(ProcessesPage),
            meta: {
              title: t('reports.install.route.processesTitle'),
              icon: 'fa-solid fa-diagram-project',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'operations',
            name: 'reports-operations',
            component: markRaw(OperationsPage),
            meta: {
              title: t('reports.install.route.operationsTitle'),
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
              title: t('reports.install.route.postingsTitle'),
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
              title: t('reports.install.route.walletsTitle'),
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
                  title: t('reports.install.route.walletsCoopTitle'),
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
                  title: t('reports.install.route.walletsParticipantsTitle'),
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
              title: t('reports.install.route.accountsTitle'),
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
              title: t('reports.install.route.documentsTitle'),
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
                  title: t('reports.install.route.documentsCalendarTitle'),
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
                  title: t('reports.install.route.documentsFormsTitle'),
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
                  title: t('reports.install.route.documentsArchiveTitle'),
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
            // Перечисление удержанного налога — не реестр и не форма, а
            // обязанность налогового агента со своим жизненным циклом,
            // поэтому у неё свой раздел рядом с отчётностью.
            path: 'ndfl',
            name: 'reports-ndfl',
            component: markRaw(NdflPage),
            meta: {
              title: t('reports.install.route.ndflTitle'),
              icon: 'account_balance',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings',
            name: 'reports-settings',
            component: markRaw(SettingsPage),
            meta: {
              title: t('reports.install.route.settingsTitle'),
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
