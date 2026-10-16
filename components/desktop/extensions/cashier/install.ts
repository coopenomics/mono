import './i18n';
import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { PaymentsPage } from 'src/pages/Cooperative/Payments';
import { CashierPage } from './pages';
import { t } from './i18n';

/**
 * Стол кассира. Страницы требуют права подтверждать оплату: стол видят
 * председатель и пайщик с ролью «Кассир», а член совета читает реестр
 * платежей на столе совета.
 */
const CASHIER_RIGHT = 'Payment:confirm';

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
          {
            path: 'desk',
            name: 'cashier-desk',
            component: markRaw(CashierPage),
            meta: {
              title: t('cashier.install.cashierTitle'),
              icon: 'point_of_sale',
              requires: CASHIER_RIGHT,
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            // Тот же реестр, что на столе совета; здесь кассир подтверждает
            // оплату и прикладывает документы. `:username` фильтрует по пайщику.
            path: 'payments/:username?',
            name: 'cashier-payments',
            component: markRaw(PaymentsPage),
            meta: {
              title: t('cashier.install.paymentsTitle'),
              icon: 'receipt_long',
              requires: CASHIER_RIGHT,
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
