import { markRaw } from 'vue';
import { ExtensionsShowcase } from 'src/pages/ExtensionStore/ExtensionsShowcase';
import { InstalledExtensions } from 'src/pages/ExtensionStore/InstalledExtensions';
import { ExtensionPage } from 'src/pages/ExtensionStore/ExtensionPage';
import { ExtensionsManagement } from 'src/pages/ExtensionStore/ExtensionsManagement';
import { AccumulationFunds, ExpenseFunds } from 'src/widgets/Cooperative/Funds';
import { MemberBranchList } from 'src/pages/Cooperative/MemberBranchList';
import { ChangeRegisterPaymentsPage } from 'src/pages/Cooperative/ChangeRegisterPayments';
import { ChangeCooperativeContacts } from 'src/pages/Cooperative/ChangeContacts';
import { MembersPage } from 'src/pages/Cooperative/MembersPage';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';

export default async function (): Promise<IWorkspaceConfig> {
  return {
    workspace: 'chairman',
    title: 'Стол председателя',
    defaultRoute: 'extensions', // Маршрут по умолчанию для рабочего стола председателя
    routes: [
      {
        meta: {
          title: 'Стол председателя',
          icon: 'fa-solid fa-user-tie',
          roles: ['chairman'],
        },
        path: '/:coopname/chairman',
        name: 'chairman',
        children: [
          {
            path: 'extensions',
            name: 'extensions',
            component: markRaw(ExtensionsManagement),
            meta: {
              title: 'Магазин расширений',
              icon: 'fa-solid fa-puzzle-piece',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [
              {
                path: 'showcase',
                name: 'extstore-showcase',
                component: markRaw(ExtensionsShowcase),
                meta: {
                  title: 'Витрина расширений',
                  icon: 'fa-solid fa-store',
                  roles: ['chairman'],
                  requiresAuth: true,
                },
              },
              {
                path: 'installed',
                name: 'appstore-installed',
                component: markRaw(InstalledExtensions),
                meta: {
                  title: 'Установленные расширения',
                  icon: 'fa-solid fa-download',
                  roles: ['chairman'],
                  requiresAuth: true,
                },
              },
              {
                path: 'extension/:name',
                name: 'one-extension',
                component: markRaw(ExtensionPage),
                meta: {
                  title: 'Расширение',
                  icon: 'fa-solid fa-cog',
                  roles: ['chairman'],
                  requiresAuth: true,
                },
                children: [
                  {
                    path: 'settings',
                    name: 'extension-settings',
                    component: markRaw(ExtensionPage),
                    meta: {
                      title: 'Настройки расширения',
                      icon: 'fa-solid fa-cog',
                      roles: ['chairman'],
                      requiresAuth: true,
                    },
                  },
                  {
                    path: 'install',
                    name: 'extension-install',
                    component: markRaw(ExtensionPage),
                    meta: {
                      title: 'Установка расширения',
                      icon: 'fa-solid fa-download',
                      roles: ['chairman'],
                      requiresAuth: true,
                    },
                  },
                ],
              },
            ],
          },
          {
            path: 'settings/members',
            name: 'members',
            component: markRaw(MembersPage),
            meta: {
              title: 'Члены совета',
              icon: 'fa-solid fa-users',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/branches',
            name: 'branches',
            component: markRaw(MemberBranchList),
            meta: {
              title: 'Кооперативные Участки',
              icon: 'fa-solid fa-sitemap',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/accumulation-funds',
            name: 'accumulation-funds',
            component: markRaw(AccumulationFunds),
            meta: {
              title: 'Фонды накопления',
              icon: 'fa-solid fa-piggy-bank',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },

          {
            path: 'settings/expense-funds',
            name: 'expense-funds',
            component: markRaw(ExpenseFunds),
            meta: {
              title: 'Фонды списания',
              icon: 'fa-solid fa-money-bill-wave',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/initial-contributions',
            name: 'initial-contributions',
            component: markRaw(ChangeRegisterPaymentsPage),
            meta: {
              title: 'Паевые взносы',
              icon: 'fa-solid fa-coins',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/change-contacts',
            name: 'change-contacts',
            component: markRaw(ChangeCooperativeContacts),
            meta: {
              title: 'Контакты кооператива',
              icon: 'fa-solid fa-address-book',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
        ],
      },
    ],
  };
}
