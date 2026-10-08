import './i18n';
import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { LoansPage, LoansRegistryPage } from './pages';
import { registerDebtDecisionHandlers } from './app/decisions';
import { t } from './i18n';

// Стол «Беспроцентные займы»: займы пайщика и реестр займов совета.
export default async function (): Promise<IWorkspaceConfig[]> {
  registerDebtDecisionHandlers();

  return [{
    workspace: 'debt',
    extension_name: 'debt',
    title: t('debt.install.extensionName'),
    icon: 'request_quote',
    defaultRoute: 'debt-loans',
    routes: [
      {
        meta: {
          title: t('debt.install.extensionName'),
          icon: 'request_quote',
          requires: 'Loan:read:own',
        },
        path: '/:coopname/debt',
        name: 'debt',
        children: [
          {
            path: 'loans',
            name: 'debt-loans',
            component: markRaw(LoansPage),
            meta: {
              title: t('debt.install.myLoansNavTitle'),
              icon: 'request_quote',
              requires: 'Loan:read:own',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'registry',
            name: 'debt-registry',
            component: markRaw(LoansRegistryPage),
            meta: {
              title: t('debt.install.registryNavTitle'),
              icon: 'list_alt',
              requires: 'Loan:read:all',
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
