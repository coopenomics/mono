import { markRaw } from 'vue'
import { ShowcasePage } from 'src/pages/Marketplace/Showcase'
import { MarketplaceCatalogPage } from 'src/pages/Marketplace/MarketplaceCatalog'
import { CreateParentOfferPage } from 'src/pages/Marketplace/CreateParentOffer'
import { CreateMarketplaceOfferPage } from 'src/pages/Marketplace/CreateMarketplaceOffer'
import { UserParentOffersPage } from 'src/pages/Marketplace/UserParentOffers'
import { UserSuppliesListPage } from 'src/pages/Marketplace/UserSuppliesList'
import { MyOrdersPage } from 'src/pages/Marketplace/MyOrders'
import { OfferPage } from 'src/pages/Marketplace/OfferPage'
import { ModerationPage } from 'src/pages/Marketplace/Moderation'
import { WarehousePage } from 'src/pages/Marketplace/WarehousePage'
import { ShipmentsPage } from 'src/pages/Marketplace/ShipmentsPage'
import { DisputePage } from 'src/pages/Marketplace/DisputePage'
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
            path: 'showcase',
            name: 'marketplace-showcase',
            component: markRaw(ShowcasePage),
            meta: {
              title: 'Витрина (legacy donor — переписывается в Phase 2)',
              icon: 'fa-solid fa-store',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
              hidden: true,
            },
            children: [
              {
                path: ':id',
                name: 'marketplace-showcase-id',
                component: markRaw(ShowcasePage),
                meta: { title: 'Товар', icon: '', roles: [], hidden: true },
              },
            ],
          },
          {
            path: 'offer/:hash',
            name: 'marketplace-offer',
            component: markRaw(OfferPage),
            meta: {
              title: 'Заявка',
              icon: 'fa-solid fa-file-invoice',
              roles: [],
              requiresAuth: true,
              hidden: true,
            },
          },
          {
            // Story 4.7: canon offerer-форма создания Offer'а с cycle_type
            // и conditional-required полями. Legacy CreateParentOfferPage
            // оставлен под `create-offer-legacy` (hidden) до полного выноса
            // (техдолг marketplace2).
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
            path: 'create-offer-legacy',
            name: 'marketplace-create-offer-legacy',
            component: markRaw(CreateParentOfferPage),
            meta: {
              title: 'Создать предложение (legacy)',
              icon: 'fa-solid fa-plus-circle',
              roles: ['chairman', 'member', 'user'],
              requiresAuth: true,
              hidden: true,
            },
          },
          {
            path: 'my-offers',
            name: 'marketplace-user-offers',
            component: markRaw(UserParentOffersPage),
            meta: {
              title: 'Мои предложения',
              icon: 'fa-solid fa-boxes-stacked',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
            children: [
              {
                path: ':id',
                name: 'marketplace-user-offer-id',
                component: markRaw(UserParentOffersPage),
                meta: { title: 'Предложение', icon: '', roles: [], hidden: true },
              },
            ],
          },
          {
            // Story 4.6: новый orderer-стол «Мои заказы» (canon OrderCard).
            // Legacy UserSuppliesListPage оставлен в импортах под другим маршрутом
            // на случай fallback'а перед удалением (см. техдолг marketplace2).
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
            path: 'my-supplies-legacy',
            name: 'marketplace-user-supplies-legacy',
            component: markRaw(UserSuppliesListPage),
            meta: {
              title: 'Поставки (legacy)',
              icon: 'fa-solid fa-truck-loading',
              roles: [],
              requiresAuth: true,
              hidden: true,
            },
          },
          {
            path: 'shipments',
            name: 'marketplace-shipments',
            component: markRaw(ShipmentsPage),
            meta: {
              title: 'Перевозки',
              icon: 'fa-solid fa-truck',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            path: 'disputes',
            name: 'marketplace-disputes',
            component: markRaw(DisputePage),
            meta: {
              title: 'Претензии',
              icon: 'fa-solid fa-shield-halved',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            path: 'warehouse',
            name: 'marketplace-warehouse',
            component: markRaw(WarehousePage),
            meta: {
              title: 'Склад',
              icon: 'fa-solid fa-warehouse',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            path: 'moderation',
            name: 'marketplace-moderation',
            component: markRaw(ModerationPage),
            meta: {
              title: 'Модерация',
              icon: 'fa-solid fa-shield-halved',
              roles: ['chairman'],
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
