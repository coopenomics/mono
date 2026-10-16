import './i18n';
import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { ExpensesRegistryPage, ExpenseDetailPage } from './pages';
import { t } from './i18n';

// Шасси расходов — UI scaffold (C28-32). Зарегистрировано в
// src/processes/init-installed-extensions/extensions-registry.ts после
// расшивки 5 mutations C28-31 (b4dd4b335ac). См. README.md.
export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'expenses',
    extension_name: 'expenses',
    title: t('expenses.install.extensionName'),
    icon: 'receipt_long',
    defaultRoute: 'expenses-registry',
    routes: [
      {
        meta: {
          title: t('expenses.install.extensionName'),
          icon: 'receipt_long',
          requires: 'ExpenseProposal:read',
        },
        path: '/:coopname/expenses',
        name: 'expenses',
        // Воркспейс `expenses` не привязан ни к одному столу (меню столов
        // приходит с сервера). Реестр монтируется на столе совета как «Реестр
        // расходов», сюда проваливаются из реестра, кассы (стол кассира) и
        // авансов пайщика: страница записки `expenses-detail` общая для всех.
        children: [
          {
            path: '',
            name: 'expenses-registry',
            component: markRaw(ExpensesRegistryPage),
            meta: {
              title: t('expenses.install.registryNavTitle'),
              icon: 'receipt_long',
              requires: 'ExpenseProposal:read',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: ':hash',
            name: 'expenses-detail',
            component: markRaw(ExpenseDetailPage),
            meta: {
              title: t('expenses.install.singleExpenseNavTitle'),
              requires: 'ExpenseProposal:read',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [],
          },
        ],
      },
    ],
  }];
}
