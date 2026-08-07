import { markRaw } from 'vue'
import type { DesktopWalletCard } from 'src/shared/lib/types/desktop-wallet'
import { MarketplaceCatalogPage } from 'src/pages/Marketplace/MarketplaceCatalog'
import { MarketplaceOfferDetailPage } from 'src/pages/Marketplace/MarketplaceOfferDetail'
import { CartPage } from 'src/pages/Marketplace/Cart'
import { OrderConfirmationPage } from 'src/pages/Marketplace/OrderConfirmation'
import { CreateMarketplaceOfferPage } from 'src/pages/Marketplace/CreateMarketplaceOffer'
import { MyOrdersPage } from 'src/pages/Marketplace/MyOrders'
// TODO(2026-07-28): страница снята со Стола ПВЗ, см. комментарий у закомментированного
// route'а 'trusted-persons' ниже — импорт временно отключён, файл страницы не удалён.
// import { OperatorTrustedPersonsPage } from 'src/pages/Marketplace/OperatorTrustedPersons'
import { OperatorBranchEconomyPage } from 'src/pages/Marketplace/OperatorBranchEconomy'
import { OperatorBranchOrdersPage } from 'src/pages/Marketplace/OperatorBranchOrders'
import { OperatorBranchOrderDetailPage } from 'src/pages/Marketplace/OperatorBranchOrderDetail'
import { AdminMarketEconomyPage } from 'src/pages/Marketplace/AdminMarketEconomy'
import { OperatorIssuancePage } from 'src/pages/Marketplace/OperatorIssuance'
import { OrdererOrderDetailPage } from 'src/pages/Marketplace/OrdererOrderDetail'
import { OrdererReceiveCodePage } from 'src/pages/Marketplace/OrdererReceiveCode'
import { OperatorReturnClaimsPage } from 'src/pages/Marketplace/OperatorReturnClaims'
import { OperatorReturnClaimDetailPage } from 'src/pages/Marketplace/OperatorReturnClaimDetail'
import { OperatorReceptionPage } from 'src/pages/Marketplace/OperatorReception'
import { OffererPendingAplReceptionsPage } from 'src/pages/Marketplace/OffererPendingAplReceptions'
import { OffererSupplyPreparationPage } from 'src/pages/Marketplace/OffererSupplyPreparation'
import { OffererShipPartyPage } from 'src/pages/Marketplace/OffererShipParty'
import { OffererPaymentHistoryPage } from 'src/pages/Marketplace/OffererPaymentHistory'
import { AdminWriteoffsPage } from 'src/pages/Marketplace/AdminWriteoffs'
import { ChairmanModerationPage } from 'src/pages/Marketplace/ChairmanModeration'
import { AdminOrdersPage } from 'src/pages/Marketplace/AdminOrders'
import { AdminOrderDetailPage } from 'src/pages/Marketplace/AdminOrderDetail'
import { AdminOffersPage } from 'src/pages/Marketplace/AdminOffers'
import { AdminIssuancePointsPage } from 'src/pages/Marketplace/AdminIssuancePoints'
import { OperatorWarehouseDeskPage } from 'src/pages/Marketplace/OperatorWarehouseDesk'
import { AdminWarehouseSummaryPage } from 'src/pages/Marketplace/AdminWarehouseSummary'
import { AdminContainerRegistryPage } from 'src/pages/Marketplace/AdminContainerRegistry'
import { EcosystemRegistryPage } from 'src/pages/Marketplace/EcosystemRegistry'
import { OnboardingCoopAcceptCppPage } from 'src/pages/Marketplace/OnboardingCoopAcceptCpp'
import { OffererIncomingOrdersPage } from 'src/pages/Marketplace/OffererIncomingOrders'
import { OffererMyOffersPage } from 'src/pages/Marketplace/OffererMyOffers'
import { ChairmanCategoryWhitelistPage } from 'src/pages/Marketplace/ChairmanCategoryWhitelist'
import { BoardPayoutsReadonlyPage } from 'src/pages/Marketplace/BoardPayoutsReadonly'
import { OnboardingMemberPickCppPage } from 'src/pages/Marketplace/OnboardingMemberPickCpp'
import { SupplierOnboardingPage } from 'src/pages/Marketplace/SupplierOnboarding'
import { SupplierRegistryPage } from 'src/pages/Marketplace/SupplierRegistry'
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace'
import { agreementsBase } from 'src/shared/lib/consts/workspaces'
import { registerGlobalOverlay } from 'src/shared/lib/overlays'
import { registerRealtimeSubscription } from 'src/shared/lib/realtime'
import {
  OnsiteSignatureGateOverlay,
  createMarketplaceEventsSubscription,
} from 'src/widgets/Marketplace/OnsiteSignatureGate'
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
 *   - market                   → `Order:create`      (orderer-эксклюзивный грант,
 *       НЕ выдаётся admin/board — иначе председатель видел бы рабочие страницы
 *       заказчика до подписи своей персональной оферты, см. ниже)
 *   - market-supplier          → `Offer:create:own`  (offerer-эксклюзивный грант;
 *       НЕ `Offer:read` — это право есть и у orderer, и у admin (каталог/модерация),
 *       поэтому им нельзя гейтить рабочие страницы поставщика — председатель без
 *       одобренного допуска видел бы «Мои предложения» и т.д., см. ниже)
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

  // Глобальный гейт подписи на месте (Фаза 1) — расширение само вкладывает свой
  // оверлей в универсальный реестр ядра, как и process-info-хендлеры выше. App
  // его не импортирует; он сам решает свою видимость (поставщик очно / заказчик
  // на получении).
  registerGlobalOverlay('marketplace:onsite-signature-gate', OnsiteSignatureGateOverlay)

  // Фаза 2: расширение вкладывает свою realtime-подписку в канал ядра (как и
  // оверлей выше). Ядро откроет её при авторизации и будет дёргать catch-up;
  // события персонального канала пайщика обновляют гейт без поллинга.
  registerRealtimeSubscription(createMarketplaceEventsSubscription())

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
              // `Onboarding:orderer`, которое backend выдаёт, пока не выполнены
              // ОБА условия допуска заказчика: подписана персональная оферта
              // (requires_gate=false) И выбран пункт выдачи в корзине
              // (`delivery_braname`). Тогда это единственная видимая страница
              // стола заказчика — рабочие страницы (Каталог и т.д.) требуют
              // orderer-прав, которых до выполнения обоих условий нет. После
              // выполнения маркер исчезает, страница авто-скрывается, а дефолт
              // стола (Каталог) и остальные пункты открываются.
              path: 'onboarding/member-cpp',
              name: 'marketplace-onboarding-member-cpp',
              component: markRaw(OnboardingMemberPickCppPage),
              meta: {
                title: 'Подключение к Столу заказов',
                icon: 'handshake',
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
              // Эпик 15: страница полного описания предложения. Скрыта из меню
              // (hidden) — открывается по клику на карточку в каталоге. Несёт
              // полное описание, участки поставки, гарантию и галерею; карточка
              // показывает лишь категорию + поставщика + краткое описание.
              path: 'offer/:offerId',
              name: 'marketplace-offer-detail',
              component: markRaw(MarketplaceOfferDetailPage),
              meta: {
                title: 'Предложение',
                icon: 'fa-solid fa-box',
                requires: 'Order:create',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
              },
              children: [],
            },
            {
              // Эпик 16 / Story 16.1-16.2: корзина заказчика и оформление.
              // Точка оформления: позиции (одна корзина — один КУ), правка
              // количества, «Оформить заказ» → заказ-агрегат под общим
              // checkout_id на текущий КУ. Требует orderer-грант Order:create.
              path: 'cart',
              name: 'marketplace-cart',
              component: markRaw(CartPage),
              meta: {
                title: 'Корзина',
                icon: 'shopping_cart',
                requires: 'Order:create',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Финальный экран после оформления: сводка заказа-агрегата
              // (созданные заказы + непрошедший остаток). Отдельная страница,
              // чтобы не показывать итог в опустевшей корзине. Скрыт из меню —
              // открывается редиректом после «Оформить заказ».
              path: 'order-confirmation',
              name: 'marketplace-order-confirmation',
              component: markRaw(OrderConfirmationPage),
              meta: {
                title: 'Заказ оформлен',
                icon: 'task_alt',
                requires: 'Order:create',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
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
              // «Получить заказ» — отдельный пункт меню с одним account-bound
              // QR-кодом на всю страницу. Вынесен в меню (а не в действие шапки)
              // намеренно: код должен быть очевидно findable, пайщику не нужно
              // объяснять, где его искать на пункте выдачи.
              path: 'receive-code',
              name: 'marketplace-receive-code',
              component: markRaw(OrdererReceiveCodePage),
              meta: {
                title: 'Получить заказ',
                icon: 'fa-solid fa-qrcode',
                requires: 'Order:create',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Детальная страница заказа. Скрыта из меню (hidden) —
              // открывается по клику на карточку в «Моих заказах». Управление
              // (отмена, «Подписать и получить») живёт в самой карточке и здесь;
              // отдельной страницы «Готово к получению» больше нет — статус
              // READY_TO_RECEIVE стал обычным этапом общего списка заказов.
              path: 'orders/:orderId',
              name: 'marketplace-order-detail',
              component: markRaw(OrdererOrderDetailPage),
              meta: {
                title: 'Заказ',
                icon: 'fa-solid fa-receipt',
                requires: 'Order:create',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
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
              // Онбординг поставщика: backend выдаёт `Onboarding:offerer`
              // пайщику без одобренного допуска в реестре — тогда виден только
              // этот экран (выбор модели + реквизиты договора + заявка). После
              // одобрения offerer-роль даёт `Offer:create:own` и открывает стол.
              // Зеркало L3-гейта заказчика (marketplace-onboarding-member-cpp).
              path: 'onboarding',
              name: 'marketplace-onboarding-supplier',
              component: markRaw(SupplierOnboardingPage),
              meta: {
                title: 'Подключение к Столу поставщика',
                icon: 'storefront',
                requires: 'Onboarding:offerer',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
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
                requires: 'Offer:create:own',
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
                requires: 'Offer:create:own',
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
                requires: 'Offer:create:own',
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
                requires: 'Offer:create:own',
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
                requires: 'Offer:create:own',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // «Отгрузить партию» — отдельный пункт меню с одним account-bound
              // Pickup-QR на всю страницу. Тот же код, что в действии шапки
              // «Подготовки отгрузки», но вынесен явным пунктом сразу после неё —
              // чтобы поставщик не пропустил, где взять код на приёмке (зеркало
              // пункта «Получить заказ» у заказчика).
              path: 'ship-party',
              name: 'marketplace-ship-party',
              component: markRaw(OffererShipPartyPage),
              meta: {
                title: 'Отгрузить партию',
                icon: 'fa-solid fa-qrcode',
                requires: 'Offer:create:own',
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
                title: 'Подпись передачи',
                icon: 'fa-solid fa-file-signature',
                requires: 'Offer:create:own',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Эпик 5 / Story 5.9: offerer-стол «Выплаты». Настройка
              // «выплаты получаю на…» (реквизиты ядра) + история выплат
              // MarketplaceOutgoingPaymentRequest по закрытым актам приёмки.
              path: 'payments',
              name: 'marketplace-payments',
              component: markRaw(OffererPaymentHistoryPage),
              meta: {
                title: 'Выплаты',
                icon: 'fa-solid fa-money-bill-transfer',
                requires: 'Offer:create:own',
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
      defaultRoute: 'marketplace-pvz-reception',
      routes: [
        {
          // Стол ПВЗ — рабочее место оператора КОНКРЕТНОГО кооперативного
          // участка (marketplace-роль `operator` → `Warehouse:read:own-KU`):
          // председателя КУ (trustee) либо его доверенного лица (trusted).
          // Активный КУ определяется через `marketplaceWhoAmI.branches`
          // (entities/OperatorBranch), коды участков в UI не показываются.
          // Управление сетью ПВЗ кооператива (создание/геокодинг/статусы) —
          // на столе администратора (AdminIssuancePoints), не здесь.
          // Гейтинг — через grants, отдельный per-route guard не нужен.
          meta: {
            title: 'Стол ПВЗ',
            icon: 'fa-solid fa-map-location-dot',
          },
          path: '/:coopname/market-pvz',
          name: 'market-pvz',
          children: [
            {
              // Поток IV: единый operator-стол «Ожидаемые поставки» — лента партий,
              // направленных на КУ оператора (own-KU scoping через
              // marketplaceListShipmentsByBraname + isMemberOfBranch), их состав
              // («что/когда/кому везут») И приёмка по QR-коду на одной странице.
              // Отдельный стол «Приёмка партии» слит сюда: оператор не прыгает
              // между «жду» и «принимаю» (ревью 2026-06-01).
              path: 'reception',
              name: 'marketplace-pvz-reception',
              component: markRaw(OperatorReceptionPage),
              meta: {
                title: 'Ожидаемые поставки',
                icon: 'fa-solid fa-truck-arrow-right',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Эпик 19: единый стол складского хозяйства участка. Раскладка,
              // склад, обезличенный остаток, списание и боксы — разделами одной
              // страницы, а не пятью пунктами меню: это одна сущность с разных
              // сторон, а боксы вообще заводят однажды и потом не открывают
              // месяцами. Права на разделы разные, поэтому вкладки списания и
              // боксов страница показывает по грантам, а не по маршруту.
              //
              // Раздел — в адресе, поэтому на нужную вкладку можно дать ссылку.
              // Без раздела открывается раскладка: это ежедневная работа.
              path: 'warehouse/:section?',
              name: 'marketplace-pvz-warehouse',
              component: markRaw(OperatorWarehouseDeskPage),
              meta: {
                title: 'Склад',
                icon: 'fa-solid fa-boxes-stacked',
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
              // Универсальная детальная страница заявления на возврат — одна и
              // та же для всех статусов (на рассмотрении / ожидает визита /
              // архив). Скрыта из меню, открывается кликом по карточке из
              // «Гарантийных возвратов» (см. review 2026-07-29: раньше архивная
              // карточка была тупиковой, решения принимались только инлайн в
              // списке — теперь везде один путь: карточка → страница → статус
              // + контекстное действие).
              path: 'returns/:claimId',
              name: 'marketplace-pvz-return-detail',
              component: markRaw(OperatorReturnClaimDetailPage),
              meta: {
                title: 'Гарантийный возврат',
                icon: 'fa-solid fa-clipboard-check',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
              },
              children: [],
            },
            // TODO(2026-07-28): раздел «Доверенные лица» снят со Стола ПВЗ —
            // он обходил стороной уже существующий полноценный флоу КУ
            // (заявка → одобрение председателем → генерация и подпись
            // документов 327/330, см. KuBranchDetailsWidget.vue), просто
            // добавляя/снимая trusted[] участка без заявления и документа.
            // Страница (OperatorTrustedPersonsPage.vue) и её импорт оставлены
            // как есть — решение на будущее: либо удалить насовсем, либо
            // перенести на «Стол председателя» отдельным ручным механизмом
            // (участок → пайщик → срок действия/номер доверенности —
            // полей для этого сейчас нет нигде в системе, потребует новой
            // off-chain таблицы, см. обсуждение в истории задачи).
            // {
            //   path: 'trusted-persons',
            //   name: 'marketplace-pvz-trusted-persons',
            //   component: markRaw(OperatorTrustedPersonsPage),
            //   meta: {
            //     title: 'Доверенные лица',
            //     icon: 'group',
            //     requires: 'Warehouse:read:own-KU',
            //     requiresAuth: true,
            //     agreements: agreementsBase,
            //   },
            // },
            {
              // Экономика участка (requirement b6): ставка кооператива,
              // отсечка и веса распределения членских взносов (правки —
              // председателю КУ), персональные кошельки доверенных с
              // переводом в Стол заказов и материальной помощью.
              path: 'economy',
              name: 'marketplace-pvz-economy',
              component: markRaw(OperatorBranchEconomyPage),
              meta: {
                title: 'Экономика участка',
                icon: 'savings',
                requires: 'Economy:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // requirement (2026-08-03): реестр заказов своего участка —
              // та же вёрстка, что у администратора, отфильтрованная по
              // своему КУ; «Экономика участка» (движения по кошельку)
              // ссылается сюда на конкретный заказ по order_hash.
              path: 'orders',
              name: 'marketplace-pvz-orders',
              component: markRaw(OperatorBranchOrdersPage),
              meta: {
                title: 'История заказов',
                icon: 'receipt_long',
                requires: 'Order:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
            },
            {
              // Страница одного заказа участка. Скрыта из меню — открывается
              // кликом по строке реестра и ссылкой из движения в «Экономике
              // участка» (раньше на её месте был разворот строки таблицы).
              path: 'orders/:orderId',
              name: 'marketplace-pvz-order-detail',
              component: markRaw(OperatorBranchOrderDetailPage),
              meta: {
                title: 'Заказ участка',
                icon: 'receipt_long',
                requires: 'Order:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
              },
              children: [],
            },
            {
              // «Сканировать QR» — сквозной универсальный считыватель. Пункт меню
              // НЕ открывает страницу (нет component), а вызывает действие
              // `marketplaceUniversalScan` (всплывающий сканер, как кнопка
              // «Поддержка»; держатель — UniversalScannerHost в layout). Оператор
              // сканирует ЛЮБОЙ код, и система по его виду ведёт на нужный стол:
              // код поставщика/ТТН → приёмка, код заказчика → выдача. Стоит
              // последним — это сквозное действие, а не раздел.
              path: 'scan',
              name: 'marketplace-pvz-scan',
              meta: {
                title: 'Сканировать QR',
                icon: 'qr_code_scanner',
                action: 'marketplaceUniversalScan',
                requires: 'Warehouse:read:own-KU',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
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
      // Реестр всех заказов кооператива — центральный обзорный экран стола;
      // открывается первым.
      defaultRoute: 'marketplace-admin-orders',
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
              // Единый реестр всех заказов кооператива с текущими статусами
              // (`Order:read:all` есть у board_readonly и admin). Раскрытие заказа
              // показывает его состояние (таймлайн) и детализацию процесса
              // p.mkt.supply — документы + операции + проводки по order_hash —
              // через общий виджет ProcessDetailCard, без ссылок на стол
              // бухгалтера (у администратора/совета может не быть к нему доступа).
              path: 'orders',
              name: 'marketplace-admin-orders',
              component: markRaw(AdminOrdersPage),
              meta: {
                title: 'Реестр заказов',
                icon: 'receipt_long',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Страница одного заказа кооператива. Скрыта из меню —
              // открывается кликом по строке реестра (раньше на её месте был
              // разворот строки таблицы).
              path: 'orders/:orderId',
              name: 'marketplace-admin-order-detail',
              component: markRaw(AdminOrderDetailPage),
              meta: {
                title: 'Заказ',
                icon: 'receipt_long',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
              },
              children: [],
            },
            {
              // Реестр поставщиков: модель работы, договор (номер + дата),
              // статус допуска. Администратор видит реестр и добавляет поставщика
              // напрямую (`Supplier:manage`); одобрение/отклонение заявок —
              // действие председателя (кнопки в строке видны только ему).
              path: 'suppliers',
              name: 'marketplace-suppliers',
              component: markRaw(SupplierRegistryPage),
              meta: {
                title: 'Реестр поставщиков',
                icon: 'storefront',
                requires: 'Supplier:manage',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              // Реестр всех предложений кооператива любого статуса
              // (опубликованные/снятые/отклонённые/на модерации), всех
              // поставщиков (`Offer:read:all` — у admin и board_readonly).
              // Отдельно от «Модерации» (там только ждущие решения); на эти
              // карточки ведёт переход «Открыть предложение» из реестра заказов.
              path: 'offers',
              name: 'marketplace-admin-offers',
              component: markRaw(AdminOffersPage),
              meta: {
                title: 'Реестр предложений',
                icon: 'sell',
                requires: 'Offer:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
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
              // Эпик 15: полная карточка предложения для модератора —
              // открывается по клику на карточку в «Модерации». Та же
              // страница, что и в каталоге, но на столе администратора
              // (`Order:read:all`), без перехода на стол заказчика.
              // `readonly: true` → страница прячет кнопку «Заказать» и ведёт
              // назад в «Модерацию», а не в каталог.
              path: 'offer/:offerId',
              name: 'marketplace-admin-offer-detail',
              component: markRaw(MarketplaceOfferDetailPage),
              meta: {
                title: 'Предложение',
                icon: 'fa-solid fa-box',
                requires: 'Order:read:all',
                requiresAuth: true,
                agreements: agreementsBase,
                hidden: true,
                readonly: true,
              },
              children: [],
            },
            {
              // Эпик 3 / Story 3.x: chairman-настройка whitelist'а категорий.
              // Только председатель (`Whitelist:manage` есть лишь у admin).
              path: 'economy',
              name: 'marketplace-admin-economy',
              component: markRaw(AdminMarketEconomyPage),
              meta: {
                title: 'Экономика',
                icon: 'percent',
                requires: 'Economy:set-fee',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
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
              // Эпик 19: сводный реестр тары кооператива. Оператор видит боксы
              // только своего участка — здесь виден весь парк с заполненностью и
              // суммарным объёмом (задел под перевозку между участками).
              // Скрывается сам при выключенных боксах: backend не выдаёт
              // `Container:read:all`, пока контур не включён в настройках.
              path: 'containers',
              name: 'marketplace-admin-containers',
              component: markRaw(AdminContainerRegistryPage),
              meta: {
                title: 'Боксы кооператива',
                icon: 'inbox',
                requires: 'Container:read:all',
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

/**
 * Кошельки, которые «Стол заказов» приносит на стол пайщика (путь B).
 * Членский кошелёк программы (`w.mkt.member`) — туда зачисляются возвратные
 * членские средства стола заказов. Главный членский ЦК (`w.wal.member`) и
 * резерв под заказ (`w.mkt.order`) здесь НЕ показываем.
 */
export const walletCards: DesktopWalletCard[] = [
  {
    wallet_name: 'w.mkt.member',
    label: 'Членский кошелёк',
    description: 'Стол заказов',
    accent: 'wallet',
    icon: 'card_membership',
  },
]
