import { markRaw } from 'vue'
import { ModerationPage } from 'src/pages/Marketplace/Moderation'
import { SuppliesListPage } from 'src/pages/Marketplace/SuppliesList'
import { SettingsPage } from 'src/pages/Marketplace/SettingsPage'
import { agreementsBase } from 'src/shared/lib/consts/workspaces'
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace'

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'market-admin',
    extension_name: 'market-admin',
    title: 'Стол администратора',
    icon: 'fa-solid fa-shop-lock',
    defaultRoute: 'marketplace-settings',
    routes: [
      {
        meta: {
          title: 'Стол администратора',
          icon: 'fa-solid fa-shop-lock',
          roles: ['chairman', 'member'],
        },
        path: '/:coopname/market-admin',
        name: 'market-admin',
        children: [
          {
            path: 'settings',
            name: 'marketplace-settings',
            component: markRaw(SettingsPage),
            meta: {
              title: 'Настройки',
              icon: 'fa-solid fa-gear',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            path: 'moderation',
            name: 'marketplace-moderation-admin',
            component: markRaw(ModerationPage),
            meta: {
              title: 'Модерация',
              icon: 'fa-solid fa-shield-halved',
              roles: ['member', 'chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            path: 'supplies',
            name: 'marketplace-supplies-admin',
            component: markRaw(SuppliesListPage),
            meta: {
              title: 'Все заказы',
              icon: 'fa-solid fa-boxes-stacked',
              roles: ['member', 'chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
        ],
      },
    ],
  }]
}
