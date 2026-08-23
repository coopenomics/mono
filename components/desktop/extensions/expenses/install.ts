import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import {
  ExpensesRegistryPage,
  ExpenseDetailPage,
  ExpensesAdminApprovePage,
  CashierPage,
  MyAdvancesPage,
} from './pages';

// Шасси расходов — UI scaffold (C28-32). Зарегистрировано в
// src/processes/init-installed-extensions/extensions-registry.ts после
// расшивки 5 mutations C28-31 (b4dd4b335ac). См. README.md.
export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'expenses',
    extension_name: 'expenses',
    title: 'Расходы',
    icon: 'receipt_long',
    defaultRoute: 'expenses-registry',
    routes: [
      {
        meta: {
          title: 'Расходы',
          icon: 'receipt_long',
          roles: [],
        },
        path: '/:coopname/expenses',
        name: 'expenses',
        // ВНИМАНИЕ: воркспейс `expenses` пока НЕ привязан ни к одному столу
        // (меню столов приходит с бэкенда; setRoutes вешает пункт лишь если
        // воркспейс есть в desktop-конфиге). Поэтому страницы ниже — рабочий
        // КАРКАС будущего «стола кассира» (касса/одобрение/мои авансы):
        // открываются только по прямому URL, в навигации их нет, и НИЧЕГО на
        // них не ведёт намеренно. НЕ удалять как «мёртвый код» — соберём стол
        // кассира из них позже. Реально используются сейчас только
        // expenses-registry (монтируется на столе совета как «Реестр расходов»)
        // и expenses-detail (деталь, куда проваливается реестр). Рабочие ссылки
        // (напоминатель об авансах и т.п.) ведут на личные «Платежи»
        // /:coopname/user/payments, НЕ на эти каркасные страницы.
        children: [
          {
            path: '',
            name: 'expenses-registry',
            component: markRaw(ExpensesRegistryPage),
            meta: {
              title: 'Реестр расходов',
              icon: 'receipt_long',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'admin/approve',
            name: 'expenses-admin-approve',
            component: markRaw(ExpensesAdminApprovePage),
            meta: {
              title: 'На одобрение председателя',
              icon: 'gavel',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'cashier',
            name: 'expenses-cashier',
            component: markRaw(CashierPage),
            meta: {
              title: 'Касса',
              icon: 'payments',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'my/advances',
            name: 'expenses-my-advances',
            component: markRaw(MyAdvancesPage),
            meta: {
              title: 'Мои авансы',
              icon: 'account_balance_wallet',
              roles: [],
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
              title: 'Расход',
              roles: [],
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
