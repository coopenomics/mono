import { markRaw } from 'vue'
import type { NavigationGuardWithThis, RouteLocationNormalized } from 'vue-router'
import { useSessionStore } from 'src/entities/Session'
import { useDesktopStore } from 'src/entities/Desktop/model'
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
import { OperatorIncomingShipmentsPage } from 'src/pages/Marketplace/OperatorIncomingShipments'
import { AdminWarehouseSummaryPage } from 'src/pages/Marketplace/AdminWarehouseSummary'
import { EcosystemRegistryPage } from 'src/pages/Marketplace/EcosystemRegistry'
import { OnboardingCoopAcceptCppPage } from 'src/pages/Marketplace/OnboardingCoopAcceptCpp'
import { OrdererConsolidatedPage } from 'src/pages/Marketplace/OrdererConsolidated'
import { OffererIncomingOrdersPage } from 'src/pages/Marketplace/OffererIncomingOrders'
import { OffererMyOffersPage } from 'src/pages/Marketplace/OffererMyOffers'
import { BranchChairmanBranchOrdersPage } from 'src/pages/Marketplace/BranchChairmanBranchOrders'
import { BoardAgendaWriteoffPage } from 'src/pages/Marketplace/BoardAgendaWriteoff'
import { ChairmanCategoryWhitelistPage } from 'src/pages/Marketplace/ChairmanCategoryWhitelist'
import { BoardPayoutsReadonlyPage } from 'src/pages/Marketplace/BoardPayoutsReadonly'
import { OnboardingMemberPickCppPage } from 'src/pages/Marketplace/OnboardingMemberPickCpp'
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace'
import { agreementsBase } from 'src/shared/lib/consts/workspaces'
import { registerMarketplaceProcessInfoHandlers } from './app/extensions'
import { useMarketSessionStore } from './model/market-session-store'

// Per-route guard для `/market-pvz/*`: пускаем пайщиков, у которых
// есть marketplace-роль `operator` (председатель/доверенное лицо КУ)
// или `admin` (председатель кооператива). Core-guard (`roles: []`)
// эти роуты пропускает, итоговую проверку делает само расширение —
// по FSD ядро не знает про marketplace-policy.
const requireMarketplaceOperator: NavigationGuardWithThis<undefined> = async (
  to: RouteLocationNormalized,
) => {
  const session = useSessionStore()
  if (!session.isAuth) {
    return { name: 'login-redirect', query: to.query }
  }
  const market = useMarketSessionStore()
  if (!market.loaded) {
    await market.fetchRoles()
  }
  if (market.hasRole('operator') || market.hasRole('admin')) {
    return true
  }
  return { name: 'permissionDenied', query: to.query }
}

/**
 * Расширение «Стол заказов» предоставляет ЧЕТЫРЕ отдельных рабочих стола
 * (workspace), распределённых по ролям пайщика, — вместо одного смешанного:
 *
 *   1. `market`          — Стол заказчика   (доступен всем авторизованным)
 *   2. `market-supplier` — Стол поставщика  (доступен всем авторизованным)
 *   3. `market-pvz`      — Стол ПВЗ          (оператор/председатель КУ; per-route guard)
 *   4. `market-admin`    — Стол администратора (только chairman + член совета)
 *
 * ВАЖНО: каждый из этих `name` ОБЯЗАН быть объявлен в backend-реестре
 * `components/controller/src/extensions/extensions.registry.ts`
 * (`AppRegistry['market'].desktops`). Маршруты ниже привязываются к workspace
 * по `name` через `DesktopStore.setRoutes`; если backend не объявил workspace,
 * его маршруты молча теряются (см. desktop.interactor + init-installed-extensions).
 *
 * Видимость стола в переключателе определяется `meta.roles` РОДИТЕЛЬСКОГО
 * маршрута (см. `workspaceMenus` в DesktopStore + WorkspaceMenu.vue):
 * `roles: []` — виден всем, `roles: ['chairman','member']` — только им.
 * Имена дочерних маршрутов (`marketplace-*`) глобально уникальны и НЕ меняются
 * при переносе между столами — вся внутренняя навигация идёт по имени.
 */
export default async function (): Promise<IWorkspaceConfig[]> {
  registerMarketplaceProcessInfoHandlers()

  // ── Канон онбординга расширения ────────────────────────────────────────
  // Пока совет не принял ЦПП «Стол заказов», backend (`getDesktop`) отдаёт из
  // четырёх столов только `market-admin`. Зеркалим это решение здесь: если в
  // десктопе с бэкенда есть `market-admin`, но нет `market` (Стол заказчика) —
  // значит расширение ещё не онбордено, и показываем ТОЛЬКО Стол
  // администратора с единственной страницей подключения ЦПП и только
  // председателю. Так чужие столы и страницы недоступны до решения совета.
  // Источник истины и безопасности — backend; здесь только UI-гейт.
  const desktop = useDesktopStore()
  const marketWorkspaceNames = new Set(
    (desktop.currentDesktop?.workspaces ?? [])
      .filter((w) => (w as { extension_name?: string }).extension_name === 'market')
      .map((w) => w.name),
  )
  const gatedByOnboarding =
    marketWorkspaceNames.has('market-admin') && !marketWorkspaceNames.has('market')

  if (gatedByOnboarding) {
    return [
      {
        workspace: 'market-admin',
        extension_name: 'market',
        title: 'Стол администратора',
        icon: 'fa-solid fa-shield-halved',
        defaultRoute: 'marketplace-onboarding-coop-cpp',
        routes: [
          {
            meta: {
              title: 'Стол администратора',
              icon: 'fa-solid fa-shield-halved',
              roles: ['chairman'],
            },
            path: '/:coopname/market-admin',
            name: 'market-admin',
            children: [
              {
                path: 'onboarding/coop-cpp',
                name: 'marketplace-onboarding-coop-cpp',
                component: markRaw(OnboardingCoopAcceptCppPage),
                meta: {
                  title: 'Подключение ЦПП',
                  icon: 'fa-solid fa-handshake',
                  roles: ['chairman'],
                  requiresAuth: true,
                  agreements: agreementsBase,
                  hidden: false,
                },
                children: [],
              },
            ],
          },
        ],
      },
    ]
  }

  return [
    // ───────────────────────── Стол заказчика ─────────────────────────
    {
      workspace: 'market',
      extension_name: 'market',
      title: 'Стол заказчика',
      icon: 'fa-solid fa-cart-shopping',
      defaultRoute: 'marketplace-catalog',
      routes: [
        {
          meta: {
            title: 'Стол заказчика',
            icon: 'fa-solid fa-cart-shopping',
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
              children: [],
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
              children: [],
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
              children: [],
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
              children: [],
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
              children: [],
            },
            {
              // Эпик 1 / Story 1.4 + 1.11: L3 онбординг пайщика — gate ЦПП
              // «Стол заказов». Реальная подпись делается через core
              // Registrator-мастер; здесь информационная страница со списком
              // документов + переход в мастер.
              path: 'onboarding/member-cpp',
              name: 'marketplace-onboarding-member-cpp',
              component: markRaw(OnboardingMemberPickCppPage),
              meta: {
                title: 'Подключение к Marketplace',
                icon: 'fa-solid fa-handshake-angle',
                roles: [],
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
          ],
        },
      ],
    },

    // ──────────────────────── Стол поставщика ─────────────────────────
    {
      workspace: 'market-supplier',
      extension_name: 'market',
      title: 'Стол поставщика',
      icon: 'fa-solid fa-store',
      defaultRoute: 'marketplace-my-offers',
      routes: [
        {
          meta: {
            title: 'Стол поставщика',
            icon: 'fa-solid fa-store',
            roles: [],
          },
          path: '/:coopname/market-supplier',
          name: 'market-supplier',
          children: [
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
              children: [],
            },
            {
              path: 'create-offer',
              name: 'marketplace-create-offer',
              component: markRaw(CreateMarketplaceOfferPage),
              meta: {
                title: 'Создать предложение',
                icon: 'fa-solid fa-plus-circle',
                roles: [],
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Редактирование своего предложения. Скрыт из меню (hidden) —
              // открывается из «Мои предложения» по кнопке «Редактировать».
              // Та же форма, что и создание; на сабмите вызывает
              // marketplaceUpdateOffer (статус сбрасывается в PENDING_MODERATION).
              path: 'edit-offer/:offerId',
              name: 'marketplace-edit-offer',
              component: markRaw(CreateMarketplaceOfferPage),
              meta: {
                title: 'Редактирование предложения',
                icon: 'fa-solid fa-pen',
                roles: [],
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
              },
              children: [],
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
              children: [],
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
              children: [],
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
              children: [],
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
              children: [],
            },
          ],
        },
      ],
    },

    // ──────────────────────────── Стол ПВЗ ────────────────────────────
    {
      workspace: 'market-pvz',
      extension_name: 'market',
      title: 'Стол ПВЗ',
      icon: 'fa-solid fa-map-location-dot',
      defaultRoute: 'marketplace-pvz',
      routes: [
        {
          // Стол ПВЗ открыт двум профилям пайщиков:
          //  - cooperative chairman (core-роль `chairman`) — видит все КУ;
          //  - председатель КУ или его доверенное лицо (marketplace-роль
          //    `operator`, выдаётся через `MarketplaceKuChairmenService`).
          // OR-логика подключается router-guard'ом при наличии обоих
          // ограничений (см. processes/navigation-guard-setup).
          meta: {
            title: 'Стол ПВЗ',
            icon: 'fa-solid fa-map-location-dot',
            roles: [],
          },
          path: '/:coopname/market-pvz',
          name: 'market-pvz',
          beforeEnter: requireMarketplaceOperator,
          children: [
            {
              path: 'list',
              name: 'marketplace-pvz',
              component: markRaw(PvzListPage),
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'ПВЗ кооператива',
                icon: 'fa-solid fa-map-location-dot',
                roles: [],
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Поток IV шаг 1: operator-стол «Ожидаемые поставки». Лента партий,
              // направленных на КУ оператора (own-KU scoping через
              // marketplaceListShipmentsByBraname + isMemberOfBranch). Оператор
              // видит, что поставщик подготовил к отгрузке, и по приходу открывает
              // приёмку на столе /reception. Read-only обзор.
              path: 'incoming-shipments',
              name: 'marketplace-pvz-incoming-shipments',
              component: markRaw(OperatorIncomingShipmentsPage),
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'Ожидаемые поставки',
                icon: 'fa-solid fa-truck-arrow-right',
                roles: [],
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
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'Приёмка партии',
                icon: 'fa-solid fa-box-open',
                roles: [],
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
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'Маркировка имущества',
                icon: 'fa-solid fa-tag',
                roles: [],
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
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'Выдача заказов',
                icon: 'fa-solid fa-handshake',
                roles: [],
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
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'Гарантийные возвраты',
                icon: 'fa-solid fa-clipboard-check',
                roles: [],
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 6 / Story 6.x: «Сводный стол КУ» — объединяет ленты
              // приёмок / выдач / возвратов в один экран с табами и счётчиками
              // для председателя КУ. Read-only обзор; действия — на /reception,
              // /issuance, /returns.
              path: 'branch-orders',
              name: 'marketplace-pvz-branch-orders',
              component: markRaw(BranchChairmanBranchOrdersPage),
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'Сводный стол КУ',
                icon: 'fa-solid fa-list-check',
                roles: [],
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
              beforeEnter: requireMarketplaceOperator,
              meta: {
                title: 'Склад моего КУ',
                icon: 'fa-solid fa-boxes-stacked',
                roles: [],
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
          ],
        },
      ],
    },

    // ──────────────────────── Стол администратора ─────────────────────
    {
      workspace: 'market-admin',
      extension_name: 'market',
      title: 'Стол администратора',
      icon: 'fa-solid fa-shield-halved',
      defaultRoute: 'marketplace-moderation',
      routes: [
        {
          meta: {
            title: 'Стол администратора',
            icon: 'fa-solid fa-shield-halved',
            // Стол администратора виден только председателю и членам совета —
            // обычный пайщик его в переключателе не увидит (см. workspaceMenus).
            roles: ['chairman', 'member'],
          },
          path: '/:coopname/market-admin',
          name: 'market-admin',
          children: [
            {
              // Эпик 3 / Story 3.6: admin-стол модерации offer'ов. Председатель
              // (или общий администратор) видит ленту предложений в статусе
              // PENDING_MODERATION и одобряет их через `marketplaceApproveOffer`
              // (status → APPROVED → попадает в публичный каталог Story 3.5).
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
              children: [],
            },
            {
              // Эпик 3 / Story 3.x: chairman-настройка whitelist'а доступных
              // категорий. Пустой whitelist = весь глобальный каталог; иначе
              // публиковать Offer'ы можно только в перечисленных категориях.
              path: 'category-whitelist',
              name: 'marketplace-category-whitelist',
              component: markRaw(ChairmanCategoryWhitelistPage),
              meta: {
                title: 'Доступные категории',
                icon: 'fa-solid fa-filter',
                roles: ['chairman'],
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 8 / Story 8.7: admin-стол списания скоропорта. Председатель
              // или общий администратор собирает черновик проекта списания,
              // подписывает Заявление 1106 и отправляет проект в совет.
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
              children: [],
            },
            {
              // Эпик 8 / Story 8.x: read-only лента writeoff-проектов для совета.
              // Совет видит проекты в статусах ON_AGENDA / AUTHORIZED /
              // EXECUTING / EXECUTED / REJECTED. Голосование совета идёт
              // через core soviet agenda (sov-flow), здесь только обзор.
              path: 'board-writeoff',
              name: 'marketplace-board-writeoff',
              component: markRaw(BoardAgendaWriteoffPage),
              meta: {
                title: 'Повестка совета — списания',
                icon: 'fa-solid fa-gavel',
                roles: ['chairman', 'member'],
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 9 / Story 9.2: admin-стол сводного склада кооператива.
              // Использует canon-виджет WarehouseSummaryGrid (UX-DR16) и поверх
              // marketplace_inventory агрегирует приход/расход/остаток по
              // ku × sku. Вторая вкладка — поток заказов/поставок (FR37/FR38).
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
              children: [],
            },
            {
              // Эпик 5 / Story 5.x: read-only лента выплат поставщикам по всему
              // кооперативу для совета. Backend marketplaceListOutgoingPayments
              // под capability Payment:read:all (board/board_readonly/admin),
              // опциональный фильтр по поставщику. Подтверждает выплаты кассир.
              path: 'payouts',
              name: 'marketplace-board-payouts',
              component: markRaw(BoardPayoutsReadonlyPage),
              meta: {
                title: 'Выплаты — совет',
                icon: 'fa-solid fa-coins',
                roles: ['chairman', 'member'],
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 9 / Story 9.4: раздел экосистемы — список controller'ов
              // других кооперативов с расширением «Стол заказов». MVP — режим
              // read-only заглушки до подключения платформенного
              // `ecosystem_registry` (NFR-Sc2 / AR18).
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
              children: [],
            },
            {
              // Витрина дизайн-системы (Эпик 10): открыта председателю и членам
              // совета для утверждения 13 custom-компонентов до их применения
              // в эпиках 1-9. Скрыта от обычных пайщиков.
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
              children: [],
            },
            {
              // Эпик 1 / Story 1.9-1.10: L1 онбординг — приём кооперативом ЦПП
              // «Стол заказов». Председатель кооператива принимает Положение
              // ЦПП Marketplace, подписывая оферту в
              // `coop_registration_offers_registry`. После этого пайщики могут
              // проходить L3 onboarding gate и расширение становится активным.
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
              children: [],
            },
          ],
        },
      ],
    },
  ]
}
