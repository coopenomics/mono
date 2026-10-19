import './i18n';
import { markRaw, type Component } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig, IWorkspaceRoute } from 'src/shared/lib/types/workspace';
import { PaymentsPage } from 'src/pages/Cooperative/Payments';
import { AdvancesPage, ExpensesPage } from './pages';
import { t } from './i18n';

/**
 * Стол кассира. Страницы открываются правом чтения: совет и ревизор читают
 * реестр платежей, расходы и авансы; правят их председатель и кассир — кнопки
 * действий страницы показывают по праву правки (`Payment:confirm`,
 * `ExpenseProposal:submit-report` и т. п.).
 */
const PAYMENTS_READ = 'Payment:read:all';
const EXPENSES_READ = 'ExpenseRegistry:read';

/** Страница стола кассира под правом чтения `requires`. */
function page(path: string, name: string, component: Component, title: string, icon: string, requires: string): IWorkspaceRoute {
  return {
    path,
    name,
    component: markRaw(component),
    meta: { title, icon, requires, agreements: agreementsBase, requiresAuth: true },
    children: [],
  };
}

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'cashier',
    extension_name: 'cashier',
    title: t('cashier.install.title'),
    icon: 'point_of_sale',
    defaultRoute: 'cashier-payments',
    routes: [
      {
        meta: {
          title: t('cashier.install.title'),
          icon: 'point_of_sale',
          requires: PAYMENTS_READ,
        },
        path: '/:coopname/cashier',
        name: 'cashier',
        children: [
          // Тот же реестр, что на столе совета; председатель и кассир здесь
          // подтверждают оплату и прикладывают документы, совет читает.
          // `:username` фильтрует по пайщику. Стол открывается на нём.
          page('payments/:username?', 'cashier-payments', PaymentsPage, t('cashier.install.paymentsTitle'), 'receipt_long', PAYMENTS_READ),
          // Служебные записки кооператива по этапам выплаты.
          page('expenses', 'cashier-expenses', ExpensesPage, t('cashier.install.expensesTitle'), 'point_of_sale', EXPENSES_READ),
          // Выданные авансы под отчёт по кооперативу с отбором по состоянию.
          page('advances', 'cashier-advances', AdvancesPage, t('cashier.install.advancesTitle'), 'savings', EXPENSES_READ),
        ],
      },
    ],
  }];
}
