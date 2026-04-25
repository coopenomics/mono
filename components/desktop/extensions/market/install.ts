import { markRaw } from 'vue'
import { ShowcasePage } from 'src/pages/Marketplace/Showcase'
import { CreateParentOfferPage } from 'src/pages/Marketplace/CreateParentOffer'
import { UserParentOffersPage } from 'src/pages/Marketplace/UserParentOffers'
import { UserSuppliesListPage } from 'src/pages/Marketplace/UserSuppliesList'
import { OfferPage } from 'src/pages/Marketplace/OfferPage'
import { ModerationPage } from 'src/pages/Marketplace/Moderation'
import { WarehousePage } from 'src/pages/Marketplace/WarehousePage'
import { ShipmentsPage } from 'src/pages/Marketplace/ShipmentsPage'
import { DisputePage } from 'src/pages/Marketplace/DisputePage'
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace'
import { agreementsBase } from 'src/shared/lib/consts/workspaces'

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'market',
    extension_name: 'market',
    title: 'Стол заказов',
    icon: 'fa-solid fa-shop',
    defaultRoute: 'marketplace-showcase',
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
            path: 'showcase',
            name: 'marketplace-showcase',
            component: markRaw(ShowcasePage),
            meta: {
              title: 'Витрина',
              icon: 'fa-solid fa-store',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
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
            path: 'create-offer',
            name: 'marketplace-create-offer',
            component: markRaw(CreateParentOfferPage),
            meta: {
              title: 'Создать предложение',
              icon: 'fa-solid fa-plus-circle',
              roles: ['chairman', 'member', 'user'],
              requiresAuth: true,
              agreements: agreementsBase,
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
            path: 'my-orders',
            name: 'marketplace-user-supplies',
            component: markRaw(UserSuppliesListPage),
            meta: {
              title: 'Мои заказы',
              icon: 'fa-solid fa-cart-shopping',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
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
        ],
      },
    ],
  }]
}
