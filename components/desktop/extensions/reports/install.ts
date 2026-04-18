import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { OperationsPage, WalletsPage, AccountsPage, DocumentsPage, SettingsPage } from './pages';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'reports',
    extension_name: 'reports',
    title: 'Отчёты ФНС',
    icon: 'fa-solid fa-file-invoice',
    defaultRoute: 'reports-operations',
    routes: [
      {
        meta: {
          title: 'Отчёты ФНС',
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
              title: 'Операции',
              icon: 'fa-solid fa-list-ul',
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
              title: 'Кошельки',
              icon: 'fa-solid fa-wallet',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'accounts',
            name: 'reports-accounts',
            component: markRaw(AccountsPage),
            meta: {
              title: 'Счета',
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
            children: [],
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
