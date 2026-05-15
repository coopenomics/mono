// Каталог 13 компонентов дизайн-системы (Story 10.2) + Tokens (Story 10.1).
// Каждый компонент — отдельная секция витрины. Принадлежность к UX-DR / FR
// зафиксирована в спецификации Эпика 10 (issue 598-13 в blago).

export interface DesignSystemSection {
  key: string
  title: string
  uxDr: string         // ссылка на UX-DR# (или Эпик)
  story: string        // Story 10.X.N
  primaryRole: string[] // на каких столах используется
  status: 'planned' | 'imported' | 'ready'
  description: string
}

export const SECTIONS: DesignSystemSection[] = [
  {
    key: 'tokens',
    title: 'Дизайн-токены',
    uxDr: 'UX-DR19..23, DR27..32',
    story: 'Story 10.1',
    primaryRole: ['все'],
    status: 'ready',
    description: 'Colors, typography, spacing, touch-targets, per-роль layout, statusbar.',
  },
  {
    key: 'takeover-dialog',
    title: 'TakeoverDialog',
    uxDr: 'UX-DR7',
    story: 'Story 10.2.1',
    primaryRole: ['все'],
    status: 'ready',
    description: 'Full-screen takeover для критических действий: 4 kind (info / success / warning / danger), confirm-loader, slot actions.',
  },
  {
    key: 'wallet-timeline',
    title: 'WalletTimeline',
    uxDr: 'UX-DR8',
    story: 'Story 10.2.2',
    primaryRole: ['orderer', 'offerer'],
    status: 'ready',
    description: 'Лента движений кошелька: 6 типов (deposit/block/unblock/charge/refund/payout) + empty state + фильтр.',
  },
  {
    key: 'order-card',
    title: 'OrderCard',
    uxDr: 'UX-DR9',
    story: 'Story 10.2.3',
    primaryRole: ['orderer', 'offerer', 'operator', 'admin'],
    status: 'ready',
    description: 'Карточка заказа со статусом жизненного цикла (10 status) и actions per-роль (orderer/offerer/operator/admin).',
  },
  {
    key: 'catalog-offer-card',
    title: 'CatalogOfferCard',
    uxDr: 'UX-DR10',
    story: 'Story 10.2.4',
    primaryRole: ['orderer'],
    status: 'ready',
    description: 'Карточка Offer в каталоге Витрины. Канон Стола Заказов, обёртка над widgets/Marketplace/RequestCard с расширенным API status / actions / fallback.',
  },
  {
    key: 'barcode-scanner',
    title: 'BarcodeScanner',
    uxDr: 'UX-DR11',
    story: 'Story 10.2.5',
    primaryRole: ['operator'],
    status: 'ready',
    description: 'Mock-сканер штрих-кода: idle → requesting → viewfinder → success-flash / error. Visual feedback вместо «пик» (UX-DR26).',
  },
  {
    key: 'barcode-display',
    title: 'BarcodeDisplay',
    uxDr: 'UX-DR12',
    story: 'Story 10.2.6',
    primaryRole: ['operator', 'admin'],
    status: 'ready',
    description: 'SVG-рендер штрих-кода для печати на ТТН/упаковке. 3 size + опция без подписи. jsbarcode подключается в функциональной реализации.',
  },
  {
    key: 'correction-table',
    title: 'CorrectionTable',
    uxDr: 'UX-DR13',
    story: 'Story 10.2.7',
    primaryRole: ['operator'],
    status: 'ready',
    description: 'Таблица корректировки факт vs план: inline-input на факт, дельта подсвечивается цветом, счётчики совпадений/недостач/избытков снизу.',
  },
  {
    key: 'expeditor-grouping-board',
    title: 'ExpeditorGroupingBoard',
    uxDr: 'UX-DR14',
    story: 'Story 10.2.8',
    primaryRole: ['operator'],
    status: 'ready',
    description: 'Kanban-доска экспедитора с drag-n-drop карточек заявок между маршрутами + empty-state в пустой колонке.',
  },
  {
    key: 'ttn-print-preview',
    title: 'TTNPrintPreview',
    uxDr: 'UX-DR15',
    story: 'Story 10.2.9',
    primaryRole: ['operator', 'admin'],
    status: 'ready',
    description: 'Предпросмотр ТТН А5 со встроенным BarcodeDisplay в шапке + таблица позиций + две подписи + @media print.',
  },
  {
    key: 'warehouse-summary-grid',
    title: 'WarehouseSummaryGrid',
    uxDr: 'UX-DR16',
    story: 'Story 10.2.10',
    primaryRole: ['admin'],
    status: 'ready',
    description: 'Сводный склад: приход/расход/остаток/статус, фильтр по SKU/названию, плотный admin-layout 14px.',
  },
  {
    key: 'onboarding-cpp-gate',
    title: 'OnboardingCPPGate',
    uxDr: 'UX-DR17',
    story: 'Story 10.2.11',
    primaryRole: ['все'],
    status: 'ready',
    description: 'L3-gate трёхуровневого онбординга: пакет документов per-стол, чекбоксы Required/Optional, locked-документы (унаследованные из L2), кнопка "Открыть" для каждого.',
  },
  {
    key: 'multi-channel-status',
    title: 'MultiChannelStatus',
    uxDr: 'UX-DR18',
    story: 'Story 10.2.12',
    primaryRole: ['все'],
    status: 'ready',
    description: 'Статус push / email / SMS chip-row с tooltip-details и 6 status (sent / delivered / read / failed / pending / disabled).',
  },
  {
    key: 'ku-map-with-list',
    title: 'KUMapWithList',
    uxDr: 'Эпик 2 Story 2.3',
    story: 'Story 10.2.13',
    primaryRole: ['orderer', 'admin'],
    status: 'ready',
    description: 'Карта ПВЗ + синхронный список. Канон Эпика 2. Витрина показывает layout-превью без подключения Yandex Maps SDK (реальная карта — на /market-pvz/list).',
  },
  {
    key: 'performance',
    title: 'Performance baseline',
    uxDr: 'NFR-P1/P2/P3',
    story: 'Story 10.3',
    primaryRole: ['все'],
    status: 'ready',
    description: 'Эталонные страницы P1..P4 + целевые метрики MVP / Phase 2. Manual Lighthouse перед релизом; CI-gate — Phase 2.',
  },
]

export const STATUS_LABEL: Record<DesignSystemSection['status'], string> = {
  planned:  'План',
  imported: 'Импорт',
  ready:    'Готово',
}

export const STATUS_COLOR: Record<DesignSystemSection['status'], string> = {
  planned:  'grey',
  imported: 'warning',
  ready:    'positive',
}
