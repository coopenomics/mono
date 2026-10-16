import './i18n';
import { markRaw, type Component } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig, IWorkspaceRoute } from 'src/shared/lib/types/workspace';
import { PaymentsPage } from 'src/pages/Cooperative/Payments';
import { AdvancesPage, CashierPage } from './pages';
import { t } from './i18n';

/**
 * Стол кассира. Страницы требуют права подтверждать оплату: стол видят
 * председатель и пайщик с ролью «Кассир», а член совета читает реестр
 * платежей на столе совета.
 */
const CASHIER_RIGHT = 'Payment:confirm';

/** Страница стола кассира под общим правом стола. */
function page(path: string, name: string, component: Component, title: string, icon: string): IWorkspaceRoute {
  return {
    path,
    name,
    component: markRaw(component),
    meta: { title, icon, requires: CASHIER_RIGHT, agreements: agreementsBase, requiresAuth: true },
    children: [],
  };
}

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'cashier',
    extension_name: 'cashier',
    title: t('cashier.install.title'),
    icon: 'point_of_sale',
    defaultRoute: 'cashier-desk',
    routes: [
      {
        meta: {
          title: t('cashier.install.title'),
          icon: 'point_of_sale',
          requires: CASHIER_RIGHT,
        },
        path: '/:coopname/cashier',
        name: 'cashier',
        children: [
          page('desk', 'cashier-desk', CashierPage, t('cashier.install.cashierTitle'), 'point_of_sale'),
          // Выданные авансы под отчёт по кооперативу с отбором по состоянию.
          page('advances', 'cashier-advances', AdvancesPage, t('cashier.install.advancesTitle'), 'savings'),
          // Тот же реестр, что на столе совета; здесь кассир подтверждает
          // оплату и прикладывает документы. `:username` фильтрует по пайщику.
          page('payments/:username?', 'cashier-payments', PaymentsPage, t('cashier.install.paymentsTitle'), 'receipt_long'),
        ],
      },
    ],
  }];
}
