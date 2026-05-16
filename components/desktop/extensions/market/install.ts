import { markRaw } from 'vue'
import { MarketplaceCatalogPage } from 'src/pages/Marketplace/MarketplaceCatalog'
import { CreateMarketplaceOfferPage } from 'src/pages/Marketplace/CreateMarketplaceOffer'
import { MyOrdersPage } from 'src/pages/Marketplace/MyOrders'
import { PvzListPage } from 'src/pages/Marketplace/PvzList'
import { DesignSystemPage } from 'src/pages/Marketplace/DesignSystem'
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace'
import { agreementsBase } from 'src/shared/lib/consts/workspaces'

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'market',
    extension_name: 'market',
    title: 'Стол заказов',
    icon: 'fa-solid fa-shop',
    defaultRoute: 'marketplace-catalog',
    routes: [
      {
        meta: {
          title: 'Стол заказов',
          icon: 'fa-solid fa-shop',
          roles: [],
        },
        path: '/:coopname/market',
        name: 'market',
        children: [
          {
            path: 'catalog',
            name: 'marketplace-catalog',
            component: markRaw(MarketplaceCatalogPage),
            meta: {
              title: 'Каталог',
              icon: 'fa-solid fa-store',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            path: 'create-offer',
            name: 'marketplace-create-offer',
            component: markRaw(CreateMarketplaceOfferPage),
            meta: {
              title: 'Создать предложение',
              icon: 'fa-solid fa-plus-circle',
              roles: ['chairman', 'member', 'user'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            path: 'my-orders',
            name: 'marketplace-my-orders',
            component: markRaw(MyOrdersPage),
            meta: {
              title: 'Мои заказы',
              icon: 'fa-solid fa-cart-shopping',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Витрина дизайн-системы (Эпик 10): открыта председателю и членам совета
            // для утверждения 13 custom-компонентов до их применения в эпиках 1-9.
            // Скрыта от обычных пайщиков, не выходит в production-меню для них.
            path: 'design-system',
            name: 'marketplace-design-system',
            component: markRaw(DesignSystemPage),
            meta: {
              title: 'Дизайн-система',
              icon: 'fa-solid fa-palette',
              roles: ['chairman', 'member'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
        ],
      },
    ],
  },
  {
    workspace: 'market-pvz',
    extension_name: 'market',
    title: 'Стол ПВЗ',
    icon: 'fa-solid fa-map-location-dot',
    defaultRoute: 'marketplace-pvz',
    routes: [
      {
        meta: {
          title: 'Стол ПВЗ',
          icon: 'fa-solid fa-map-location-dot',
          roles: ['chairman'],
        },
        path: '/:coopname/market-pvz',
        name: 'market-pvz',
        children: [
          {
            path: 'list',
            name: 'marketplace-pvz',
            component: markRaw(PvzListPage),
            meta: {
              title: 'ПВЗ кооператива',
              icon: 'fa-solid fa-map-location-dot',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
        ],
      },
    ],
  }]
}
