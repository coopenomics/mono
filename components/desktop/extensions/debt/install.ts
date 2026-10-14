import './i18n';
import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { LoanWalletsPage, LoansPage, LoansRegistryPage } from './pages';
import { EXTENSION_SLOTS, registerSlotComponent } from 'src/shared/lib/extension-slots';
import { registerDebtDecisionHandlers } from './app/decisions';
import { registerDebtApprovalHooks } from './app/approvals';
import { registerDebtMenuBadges } from './app/badges';
import LoanDebtWidget from './widgets/LoanDebtWidget.vue';
import { t } from './i18n';

import type { Component } from 'vue';

/** Страница стола: путь, имя, компонент, подпись и значок меню, нужное право. */
function page(path: string, name: string, component: Component, title: string, icon: string, requires: string) {
  return {
    path,
    name,
    component: markRaw(component),
    meta: { title, icon, requires, agreements: agreementsBase, requiresAuth: true },
    children: [],
  };
}

// Стол «Беспроцентные займы»: займы пайщика, обеспечение и реестр займов совета.
export default async function (): Promise<IWorkspaceConfig[]> {
  registerDebtDecisionHandlers();
  registerDebtApprovalHooks();
  registerDebtMenuBadges();
  // Задолженность по займам — на странице профиля участника «Благороста».
  registerSlotComponent(EXTENSION_SLOTS.capitalProfileAfterWallets, 'debt:loan-debt', LoanDebtWidget);

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
          page('loans', 'debt-loans', LoansPage, t('debt.install.myLoansNavTitle'), 'request_quote', 'Loan:read:own'),
          page('collateral', 'debt-wallets', LoanWalletsPage, t('debt.install.walletsTitle'), 'account_balance_wallet', 'Loan:read:own'),
          page('registry', 'debt-registry', LoansRegistryPage, t('debt.install.registryNavTitle'), 'list_alt', 'Loan:read:all'),
        ],
      },
    ],
  }];
}
