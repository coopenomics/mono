import { markRaw } from 'vue'
import { MarketplaceCatalogPage } from 'src/pages/Marketplace/MarketplaceCatalog'
import { CreateMarketplaceOfferPage } from 'src/pages/Marketplace/CreateMarketplaceOffer'
import { MyOrdersPage } from 'src/pages/Marketplace/MyOrders'
import { PvzListPage } from 'src/pages/Marketplace/PvzList'
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
import { AdminIssuancePointsPage } from 'src/pages/Marketplace/AdminIssuancePoints'
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

/**
 * Расширение «Стол заказов» предоставляет ЧЕТЫРЕ отдельных рабочих стола
 * (workspace), распределённых по ролям пайщика:
 *
 *   1. `market`          — Стол заказчика
 *   2. `market-supplier` — Стол поставщика
 *   3. `market-pvz`      — Стол ПВЗ
 *   4. `market-admin`    — Стол администратора
 *
 * ВАЖНО: каждый из этих `name` ОБЯЗАН быть объявлен в backend-реестре
 * `components/controller/src/extensions/extensions.registry.ts`
 * (`AppRegistry['market'].desktops`). Маршруты ниже привязываются к workspace
 * по `name` через `DesktopStore.setRoutes`; если backend не объявил workspace,
 * его маршруты молча теряются (см. desktop.interactor + init-installed-extensions).
 *
 * ── Канон авторизации столов (grants) ──────────────────────────────────────
 * Видимость столов и страниц НЕ задаётся здесь ролями. Каждый маршрут объявляет
 * требуемое право `meta.requires` (capability вида «Resource:action» из
 * marketplace access-matrix). Backend (`MarketplaceDesktopGrantsProvider`)
 * выдаёт текущему пользователю набор прав (`DesktopWorkspace.grants`), а фронт
 * показывает стол/страницу, только если `requires` входит в этот набор
 * (DesktopStore.isPageVisible / isWorkspaceVisible). Настоящий enforcement —
 * на резолверах бэкенда; здесь — UI-видимость + навигационный гард.
 *
 * Соответствие столов правам (как воспроизведена прежняя видимость по ролям):
 *   - market / market-supplier → `Offer:read`        (любой онбординутый пайщик)
 *   - market-pvz               → `Warehouse:read:own-KU` (оператор КУ + админ)
 *   - market-admin             → `Order:read:all`     (совет + председатель),
 *       кроме `Whitelist:manage` (только председатель) и `Extension:configure`
 *       (страница подключения ЦПП — единственное право до принятия ЦПП).
 *
 * Онбординг до принятия ЦПП обеспечивается грантами: пока совет не принял ЦПП,
 * у председателя только `Extension:configure` → виден лишь Стол администратора
 * со страницей подключения; у остальных прав нет → столы скрыты. Никакого
 * отдельного гейта во фронте не требуется — всё из backend grants.
 */
export default async function (): Promise<IWorkspaceConfig[]> {
  registerMarketplaceProcessInfoHandlers()

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
          },
          path: '/:coopname/market',
          name: 'market',
          children: [
            {
              // Эпик 1 / Story 1.4 + 1.11: L3 онбординг пайщика — gate ЦПП
              // «Стол заказов». Объявлен ПЕРВЫМ и требует выделенного права
              // `Onboarding:orderer`, которое backend выдаёт только пока пайщик
              // не подписал персональную оферту (requires_gate=true). Тогда это
              // единственная видимая страница стола заказчика — рабочие страницы
              // (Каталог и т.д.) требуют orderer-прав, которых до подписи нет.
              // После подписи маркер исчезает, страница авто-скрывается, а
              // дефолт стола (Каталог) и остальные пункты открываются.
              path: 'onboarding/member-cpp',
              name: 'marketplace-onboarding-member-cpp',
              component: markRaw(OnboardingMemberPickCppPage),
              meta: {
                title: 'Подключение к Столу заказов',
                icon: 'fa-solid fa-handshake-angle',
                requires: 'Onboarding:orderer',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'catalog',
              name: 'marketplace-catalog',
              component: markRaw(MarketplaceCatalogPage),
              meta: {
                title: 'Каталог',
                icon: 'fa-solid fa-store',
                // Рабочие страницы стола заказчика гейтятся подпиской оферты
                // ЦПП: требуем orderer-эксклюзивный грант `Order:create`. Его
                // НЕ выдают роли admin/board, и `Order:read:all` в него НЕ
                // разворачивается (нет `:all`-формы) — поэтому admin-гранты
                // председателя (или совета) не «протекают» на стол заказчика
                // до его персональной подписи. Реальный enforcement резолверов
                // использует узкие права (`Offer:read`/`Order:read:own`) как
                // прежде; здесь — только видимость стола.
                requires: 'Order:create',
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
                requires: 'Order:create',
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
                requires: 'Order:create',
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
                icon: 'fa-solid fa-box-open',
                requires: 'Order:create',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 7 / Story 7.1: orderer-стол гарантийных возвратов. Здесь
              // пайщик подаёт заявление по выданному заказу в гарантийный срок,
              // прилагает фото товара и подписывает заявление (registry_id=1104).
              path: 'returns',
              name: 'marketplace-returns',
              component: markRaw(OrdererReturnClaimsPage),
              meta: {
                title: 'Гарантийные возвраты',
                icon: 'fa-solid fa-rotate-left',
                requires: 'Order:create',
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
                requires: 'Offer:read',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Скрыт из меню (hidden) — кнопка «Создать предложение» живёт по
              // канону в правом верхнем углу шапки (телепорт через
              // useHeaderActions со стола «Мои предложения»).
              path: 'create-offer',
              name: 'marketplace-create-offer',
              component: markRaw(CreateMarketplaceOfferPage),
              meta: {
                title: 'Создать предложение',
                icon: 'fa-solid fa-plus-circle',
                requires: 'Offer:read',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
              },
              children: [],
            },
            {
              // Редактирование своего предложения. Скрыт из меню (hidden) —
              // открывается из «Мои предложения» по кнопке «Редактировать».
              path: 'edit-offer/:offerId',
              name: 'marketplace-edit-offer',
              component: markRaw(CreateMarketplaceOfferPage),
              meta: {
                title: 'Редактирование предложения',
                icon: 'fa-solid fa-pen',
                requires: 'Offer:read',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
              },
              children: [],
            },
            {
              // Эпик 4 / Story 4.5: «Входящие заказы» — поставщик видит заказы,
              // по которым он supplier. Канон OrderCard с role='offerer'.
              path: 'incoming-orders',
              name: 'marketplace-incoming-orders',
              component: markRaw(OffererIncomingOrdersPage),
              meta: {
                title: 'Входящие заказы',
                icon: 'fa-solid fa-inbox',
                requires: 'Offer:read',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 5 / Story 5.5: offerer-стол подготовки отгрузки. Поставщик
              // видит сформированные сводные заказы (статус CONFIRMED → SHIPPING)
              // и подтверждает готовность к отгрузке через `marketplaceMarkSupplyReady`.
              path: 'supply-prep',
              name: 'marketplace-supply-prep',
              component: markRaw(OffererSupplyPreparationPage),
              meta: {
                title: 'Подготовка отгрузки',
                icon: 'fa-solid fa-truck-ramp-box',
                requires: 'Offer:read',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 5 / Story 5.7: offerer-стол ожидающих подписи актов приёмки.
              // Поставщик первой подписью signapl1 подтверждает факт приёмки
              // партии ПВЗ — после этого ПВЗ закрывает акт второй подписью.
              path: 'apl-receptions',
              name: 'marketplace-apl-receptions',
              component: markRaw(OffererPendingAplReceptionsPage),
              meta: {
                title: 'Подпись приёмки',
                icon: 'fa-solid fa-file-signature',
                requires: 'Offer:read',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 5 / Story 5.9: offerer-стол «История выплат». Поставщик
              // видит список MarketplaceOutgoingPaymentRequest по своим закрытым
              // актам приёмки.
              path: 'payments',
              name: 'marketplace-payments',
              component: markRaw(OffererPaymentHistoryPage),
              meta: {
                title: 'История выплат',
                icon: 'fa-solid fa-money-bill-transfer',
                requires: 'Offer:read',
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
          // Стол ПВЗ открыт оператору/председателю КУ (marketplace-роль
          // `operator` → `Warehouse:read:own-KU`) и председателю кооператива
          // (роль `admin` → `Warehouse:read:all`, через разворот покрывает
          // own-KU). Гейтинг — через grants, отдельный per-route guard больше
          // не нужен.
          meta: {
            title: 'Стол ПВЗ',
            icon: 'fa-solid fa-map-location-dot',
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
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Поток IV шаг 1: operator-стол «Ожидаемые поставки». Лента партий,
              // направленных на КУ оператора (own-KU scoping через
              // marketplaceListShipmentsByBraname + isMemberOfBranch).
              path: 'incoming-shipments',
              name: 'marketplace-pvz-incoming-shipments',
              component: markRaw(OperatorIncomingShipmentsPage),
              meta: {
                title: 'Ожидаемые поставки',
                icon: 'fa-solid fa-truck-arrow-right',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 5 / Story 5.6: operator-стол приёмки партии на ПВЗ.
              path: 'reception',
              name: 'marketplace-pvz-reception',
              component: markRaw(OperatorReceptionPage),
              meta: {
                title: 'Приёмка партии',
                icon: 'fa-solid fa-box-open',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 5 / Story 5.8 + Эпик 6: operator-стол маркировки имущества.
              path: 'labeling',
              name: 'marketplace-pvz-labeling',
              component: markRaw(OperatorInventoryLabelingPage),
              meta: {
                title: 'Маркировка имущества',
                icon: 'fa-solid fa-tag',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 6 / Story 6.6: operator-стол выдачи имущества пайщику на ПВЗ.
              path: 'issuance',
              name: 'marketplace-issuance',
              component: markRaw(OperatorIssuancePage),
              meta: {
                title: 'Выдача заказов',
                icon: 'fa-solid fa-handshake',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 7 / Story 7.2-7.4: operator-стол гарантийных возвратов.
              path: 'returns',
              name: 'marketplace-pvz-returns',
              component: markRaw(OperatorReturnClaimsPage),
              meta: {
                title: 'Гарантийные возвраты',
                icon: 'fa-solid fa-clipboard-check',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 6 / Story 6.x: «Сводный стол КУ» — приёмки/выдачи/возвраты
              // в одном экране с табами и счётчиками для председателя КУ.
              path: 'branch-orders',
              name: 'marketplace-pvz-branch-orders',
              component: markRaw(BranchChairmanBranchOrdersPage),
              meta: {
                title: 'Сводный стол КУ',
                icon: 'fa-solid fa-list-check',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 9 / Story 9.1: operator-стол «Склад моего КУ».
              path: 'warehouse',
              name: 'marketplace-pvz-warehouse',
              component: markRaw(OperatorOwnWarehousePage),
              meta: {
                title: 'Склад моего КУ',
                icon: 'fa-solid fa-boxes-stacked',
                requires: 'Warehouse:read:own-KU',
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
          },
          path: '/:coopname/market-admin',
          name: 'market-admin',
          children: [
            {
              // Эпик 3 / Story 3.6: admin-стол модерации offer'ов. Виден совету
              // и председателю (`Order:read:all` есть у board_readonly и admin).
              path: 'moderation',
              name: 'marketplace-moderation',
              component: markRaw(ChairmanModerationPage),
              meta: {
                title: 'Модерация',
                icon: 'fa-solid fa-clipboard-check',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 3 / Story 3.x: chairman-настройка whitelist'а категорий.
              // Только председатель (`Whitelist:manage` есть лишь у admin).
              path: 'category-whitelist',
              name: 'marketplace-category-whitelist',
              component: markRaw(ChairmanCategoryWhitelistPage),
              meta: {
                title: 'Доступные категории',
                icon: 'fa-solid fa-filter',
                requires: 'Whitelist:manage',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 2: admin-стол «Пункты выдачи заказов». Председатель
              // подключает кооперативные участки (core) как ПВЗ Стола заказов
              // (адрес/контакты/режим работы + геокодинг) и управляет их
              // статусом. Видна совету и председателю (`Order:read:all`);
              // управляющие действия внутри — только председателю (isChairman),
              // что совпадает с бэкенд-авторизацией мутаций (chairman-only).
              path: 'issuance-points',
              name: 'marketplace-issuance-points',
              component: markRaw(AdminIssuancePointsPage),
              meta: {
                title: 'Пункты выдачи заказов',
                icon: 'pin_drop',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 8 / Story 8.7: admin-стол списания скоропорта.
              path: 'writeoffs',
              name: 'marketplace-writeoffs',
              component: markRaw(AdminWriteoffsPage),
              meta: {
                title: 'Списания скоропорта',
                icon: 'fa-solid fa-trash-can-arrow-up',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 8 / Story 8.x: read-only лента writeoff-проектов для совета.
              path: 'board-writeoff',
              name: 'marketplace-board-writeoff',
              component: markRaw(BoardAgendaWriteoffPage),
              meta: {
                title: 'Повестка совета — списания',
                icon: 'fa-solid fa-gavel',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 9 / Story 9.2: admin-стол сводного склада кооператива.
              path: 'warehouse-summary',
              name: 'marketplace-warehouse-summary',
              component: markRaw(AdminWarehouseSummaryPage),
              meta: {
                title: 'Сводный склад',
                icon: 'fa-solid fa-warehouse',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 5 / Story 5.x: read-only лента выплат поставщикам для совета.
              path: 'payouts',
              name: 'marketplace-board-payouts',
              component: markRaw(BoardPayoutsReadonlyPage),
              meta: {
                title: 'Выплаты — совет',
                icon: 'fa-solid fa-coins',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 9 / Story 9.4: раздел экосистемы — список controller'ов
              // других кооперативов с расширением «Стол заказов».
              path: 'ecosystem',
              name: 'marketplace-ecosystem',
              component: markRaw(EcosystemRegistryPage),
              meta: {
                title: 'Экосистема',
                icon: 'fa-solid fa-network-wired',
                requires: 'Order:read:all',
                requiresAuth: true,
                // Скрыта из меню/поиска до публикации раздела (страница и
                // маршрут остаются — снять hidden, когда раздел готов).
                hidden: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 1 / Story 1.9-1.10: L1 онбординг — приём кооперативом ЦПП
              // «Стол заказов». Председатель подписывает оферту ЦПП. ЭТА страница
              // — единственная видимая до принятия ЦПП (право `Extension:configure`
              // у председателя есть и до, и после; остальные admin-права
              // появляются только после принятия).
              path: 'onboarding/coop-cpp',
              name: 'marketplace-onboarding-coop-cpp',
              component: markRaw(OnboardingCoopAcceptCppPage),
              meta: {
                title: 'Подключение ЦПП',
                icon: 'fa-solid fa-handshake',
                requires: 'Extension:configure',
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
