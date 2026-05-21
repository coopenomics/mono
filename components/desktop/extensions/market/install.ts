import { markRaw } from 'vue'
import { MarketplaceCatalogPage } from 'src/pages/Marketplace/MarketplaceCatalog'
import { CreateMarketplaceOfferPage } from 'src/pages/Marketplace/CreateMarketplaceOffer'
import { MyOrdersPage } from 'src/pages/Marketplace/MyOrders'
import { PvzListPage } from 'src/pages/Marketplace/PvzList'
import { DesignSystemPage } from 'src/pages/Marketplace/DesignSystem'
import { OperatorIssuancePage } from 'src/pages/Marketplace/OperatorIssuance'
import { OrdererReadyToReceivePage } from 'src/pages/Marketplace/OrdererReadyToReceive'
import { OrdererReturnClaimsPage } from 'src/pages/Marketplace/OrdererReturnClaims'
import { OperatorReturnClaimsPage } from 'src/pages/Marketplace/OperatorReturnClaims'
import { OperatorReceptionPage } from 'src/pages/Marketplace/OperatorReception'
import { OperatorInventoryLabelingPage } from 'src/pages/Marketplace/OperatorInventoryLabeling'
import { OffererPendingAplReceptionsPage } from 'src/pages/Marketplace/OffererPendingAplReceptions'
import { OffererSupplyPreparationPage } from 'src/pages/Marketplace/OffererSupplyPreparation'
import { OffererPaymentHistoryPage } from 'src/pages/Marketplace/OffererPaymentHistory'
import { AdminWriteoffsPage } from 'src/pages/Marketplace/AdminWriteoffs'
import { ChairmanModerationPage } from 'src/pages/Marketplace/ChairmanModeration'
import { OperatorOwnWarehousePage } from 'src/pages/Marketplace/OperatorOwnWarehouse'
import { AdminWarehouseSummaryPage } from 'src/pages/Marketplace/AdminWarehouseSummary'
import { EcosystemRegistryPage } from 'src/pages/Marketplace/EcosystemRegistry'
import { OnboardingCoopAcceptCppPage } from 'src/pages/Marketplace/OnboardingCoopAcceptCpp'
import { OrdererConsolidatedPage } from 'src/pages/Marketplace/OrdererConsolidated'
import { OffererIncomingOrdersPage } from 'src/pages/Marketplace/OffererIncomingOrders'
import { OffererMyOffersPage } from 'src/pages/Marketplace/OffererMyOffers'
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace'
import { agreementsBase } from 'src/shared/lib/consts/workspaces'
import { registerMarketplaceProcessInfoHandlers } from './app/extensions'

export default async function (): Promise<IWorkspaceConfig[]> {
  registerMarketplaceProcessInfoHandlers()
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
            // Эпик 4 / Story 4.4: сводный обзор заказов пайщика, сгруппированных
            // по партиям (cycle_id). Дополняет «Мои заказы» — там плоский список,
            // здесь — партии time_based/volume_based/open_subscription с этапом
            // партии и суммарной стоимостью. Канон OrderCard для отдельных заказов.
            path: 'consolidated',
            name: 'marketplace-consolidated',
            component: markRaw(OrdererConsolidatedPage),
            meta: {
              title: 'Сводный заказ',
              icon: 'fa-solid fa-layer-group',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 6 / Story 6.7: лента заказов пайщика, готовых к получению
            // на пункте выдачи (статус READY_TO_RECEIVE) — визуальное
            // продолжение push-уведомления marketplace-order-ready (FR22).
            path: 'ready-to-receive',
            name: 'marketplace-ready-to-receive',
            component: markRaw(OrdererReadyToReceivePage),
            meta: {
              title: 'Готово к получению',
              icon: 'fa-solid fa-box-check',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 3 / Story 3.4: «Мои предложения» — поставщик видит все
            // свои Offer'ы во всех 4 статусах (PENDING_MODERATION / ACTIVE /
            // REJECTED / WITHDRAWN). Канон CatalogOfferCard, client-side
            // фильтр + поиск, polling 30s (статус меняет модерация).
            path: 'my-offers',
            name: 'marketplace-my-offers',
            component: markRaw(OffererMyOffersPage),
            meta: {
              title: 'Мои предложения',
              icon: 'fa-solid fa-clipboard-list',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 4 / Story 4.5: «Входящие заказы» — поставщик видит заказы,
            // по которым он supplier. Канон OrderCard с role='offerer'.
            // Действия по акцепту партии — отдельно на «Подготовка отгрузки».
            path: 'incoming-orders',
            name: 'marketplace-incoming-orders',
            component: markRaw(OffererIncomingOrdersPage),
            meta: {
              title: 'Входящие заказы',
              icon: 'fa-solid fa-inbox',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 5 / Story 5.5: offerer-стол подготовки отгрузки. Поставщик
            // видит сформированные сводные заказы (статус CONFIRMED → SHIPPING)
            // и подтверждает готовность к отгрузке через `marketplaceMarkSupplyReady`.
            // После этого ПВЗ открывает приёмку. На MVP — лента + per-row
            // действие «Готов к отгрузке».
            path: 'supply-prep',
            name: 'marketplace-supply-prep',
            component: markRaw(OffererSupplyPreparationPage),
            meta: {
              title: 'Подготовка отгрузки',
              icon: 'fa-solid fa-truck-ramp-box',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 5 / Story 5.7: offerer-стол ожидающих подписи актов приёмки.
            // Поставщик первой подписью signapl1 подтверждает факт приёмки
            // партии ПВЗ — после этого ПВЗ закрывает акт второй подписью
            // (см. `apl-reception-close` в branch-chairman). Бессрочного
            // open-state не бывает: signapl1 — это окно ~24ч.
            path: 'apl-receptions',
            name: 'marketplace-apl-receptions',
            component: markRaw(OffererPendingAplReceptionsPage),
            meta: {
              title: 'Подпись приёмки',
              icon: 'fa-solid fa-file-signature',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 5 / Story 5.9: offerer-стол «История выплат». Поставщик
            // видит список MarketplaceOutgoingPaymentRequest со статусами
            // INITIATED / CONFIRMED / FAILED по своим закрытым актам приёмки.
            // Запрос идёт через `listOutgoingPaymentsAsSupplier` с фильтром
            // payee_account = current user.
            path: 'payments',
            name: 'marketplace-payments',
            component: markRaw(OffererPaymentHistoryPage),
            meta: {
              title: 'История выплат',
              icon: 'fa-solid fa-money-bill-transfer',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 7 / Story 7.1: orderer-стол гарантийных возвратов. Здесь
            // пайщик подаёт заявление по выданному заказу в гарантийный срок,
            // прилагает фото товара и подписывает заявление (registry_id=1104).
            // Доступ: только сам заказчик (`ReturnClaim: ['create:own', 'read:own']`
            // в marketplace access-matrix), фильтрация по orderer_account.
            path: 'returns',
            name: 'marketplace-returns',
            component: markRaw(OrdererReturnClaimsPage),
            meta: {
              title: 'Гарантийные возвраты',
              icon: 'fa-solid fa-rotate-left',
              roles: [],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 8 / Story 8.7: admin-стол списания скоропорта. Председатель
            // или общий администратор собирает черновик проекта списания
            // (вручную или из крон-предложения), подписывает Заявление 1106
            // и отправляет проект в совет — `propwroff` + `soviet::createagenda
            // (type=mktwroff)`. Совет голосует через стандартный sov.decision
            // flow и подписывает Протокол 1105; backend сам циклом проводит
            // per-item списания через `execwroff` (пары o.mkt.wroff + o.mkt.wroff2).
            path: 'writeoffs',
            name: 'marketplace-writeoffs',
            component: markRaw(AdminWriteoffsPage),
            meta: {
              title: 'Списания скоропорта',
              icon: 'fa-solid fa-trash-can-arrow-up',
              roles: ['chairman', 'member'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 9 / Story 9.2: admin-стол сводного склада кооператива.
            // Использует canon-виджет WarehouseSummaryGrid (UX-DR16) и поверх
            // marketplace_inventory агрегирует приход/расход/остаток по
            // ku × sku. Вторая вкладка — поток заказов/поставок (FR37/FR38),
            // на MVP — табличные итоги, графики динамики подключаются по
            // AR37 SDK-подписки платформы.
            path: 'warehouse-summary',
            name: 'marketplace-warehouse-summary',
            component: markRaw(AdminWarehouseSummaryPage),
            meta: {
              title: 'Сводный склад',
              icon: 'fa-solid fa-warehouse',
              roles: ['chairman', 'member'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 3 / Story 3.6: admin-стол модерации offer'ов. Председатель
            // (или общий администратор) видит ленту предложений в статусе
            // PENDING_MODERATION и одобряет их через `marketplaceApproveOffer`
            // (status → APPROVED → попадает в публичный каталог Story 3.5).
            // Скрытие в access-matrix: `Marketplace.Offer: ['moderate']`
            // открыто только chairman + member-совета.
            path: 'moderation',
            name: 'marketplace-moderation',
            component: markRaw(ChairmanModerationPage),
            meta: {
              title: 'Модерация',
              icon: 'fa-solid fa-clipboard-check',
              roles: ['chairman', 'member'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 9 / Story 9.4: раздел экосистемы — список controller'ов
            // других кооперативов с расширением «Стол заказов». MVP — режим
            // read-only заглушки до подключения платформенного
            // `ecosystem_registry` (NFR-Sc2 / AR18). Полная активация —
            // вторая фаза (межкооперативная торговля).
            path: 'ecosystem',
            name: 'marketplace-ecosystem',
            component: markRaw(EcosystemRegistryPage),
            meta: {
              title: 'Экосистема',
              icon: 'fa-solid fa-network-wired',
              roles: ['chairman', 'member'],
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
          {
            // Эпик 1 / Story 1.9-1.10: L1 онбординг — приём кооперативом ЦПП
            // «Стол заказов». Председатель кооператива принимает Положение
            // ЦПП Marketplace, подписывая оферту в
            // `coop_registration_offers_registry`. После этого:
            // 1) пайщики могут проходить L3 onboarding gate;
            // 2) расширение market становится активным
            //    (extension.config.coopAcceptance.status='active').
            // Backend: marketplaceCppStatus + marketplaceAcceptCpp.
            path: 'onboarding/coop-cpp',
            name: 'marketplace-onboarding-coop-cpp',
            component: markRaw(OnboardingCoopAcceptCppPage),
            meta: {
              title: 'Подключение ЦПП',
              icon: 'fa-solid fa-handshake',
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
          {
            // Эпик 5 / Story 5.6: operator-стол приёмки партии на ПВЗ.
            // Председатель КУ открывает акт приёмки (registry_id=1102) против
            // ожидаемой поставки, сверяет фактические единицы с планом партии
            // и подписывает signapl1 (поставщик ставит вторую). На входе —
            // лента CONFIRMED партий, на выходе — переход в LABELING.
            path: 'reception',
            name: 'marketplace-pvz-reception',
            component: markRaw(OperatorReceptionPage),
            meta: {
              title: 'Приёмка партии',
              icon: 'fa-solid fa-box-open',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 5 / Story 5.8 + Эпик 6: operator-стол маркировки
            // имущества. После закрытия акта приёмки оператор клеит
            // EAN-13 на каждую единицу через `BarcodeDisplay` (UX-DR12) +
            // фиксирует факт маркировки через `marketplaceLabelInventoryItem`.
            // На MVP — single + shipment-batch режимы.
            path: 'labeling',
            name: 'marketplace-pvz-labeling',
            component: markRaw(OperatorInventoryLabelingPage),
            meta: {
              title: 'Маркировка имущества',
              icon: 'fa-solid fa-tag',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 6 / Story 6.6: operator-стол выдачи имущества пайщику
            // на ПВЗ. Лента заказов в ACCEPTED_TO_COOP (ожидают открытия
            // первой подписью signiss1) и READY_TO_RECEIVE (ожидают
            // финальной подписи заказчика signiss2). Открыто председателю
            // КУ — он же operator в access matrix marketplace.
            path: 'issuance',
            name: 'marketplace-issuance',
            component: markRaw(OperatorIssuancePage),
            meta: {
              title: 'Выдача заказов',
              icon: 'fa-solid fa-handshake',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 7 / Story 7.2-7.4: operator-стол гарантийных возвратов.
            // Председатель КУ рассматривает поступившие заявления удалённо,
            // приглашает на очный осмотр, принимает или отказывает.
            // При приёме composite-транзакция accretrn выполняет
            // compensating forward `o.mkt.return + o.mkt.return2` через
            // транзит 91 — атомарное восстановление средств заказчику и
            // возврат имущества на склад участка.
            path: 'returns',
            name: 'marketplace-pvz-returns',
            component: markRaw(OperatorReturnClaimsPage),
            meta: {
              title: 'Гарантийные возвраты',
              icon: 'fa-solid fa-clipboard-check',
              roles: ['chairman'],
              requiresAuth: true,
              agreements: agreementsBase,
            },
          },
          {
            // Эпик 9 / Story 9.1: operator-стол «Склад моего КУ».
            // Таблица marketplace_inventory отфильтрована по braname; per-row
            // статусы (LABELED / ISSUED / RETURNED / WRITTEN_OFF), фильтры по
            // статусу/orderer, summary count by status. Backend-доступ —
            // `Warehouse: ['read:own-KU']` гарантирует, что оператор видит
            // только свой участок. Real-time через AR37 SDK-подписки
            // платформы (подключается отдельным шагом эпика).
            path: 'warehouse',
            name: 'marketplace-pvz-warehouse',
            component: markRaw(OperatorOwnWarehousePage),
            meta: {
              title: 'Склад моего КУ',
              icon: 'fa-solid fa-boxes-stacked',
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
