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
    status: 'planned',
    description: 'Визуализация движений кошелька (блокировка, списание, возврат).',
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
    status: 'planned',
    description: 'Сканер штрих-кода через camera-API / USB. Visual feedback вместо «пик».',
  },
  {
    key: 'barcode-display',
    title: 'BarcodeDisplay',
    uxDr: 'UX-DR12',
    story: 'Story 10.2.6',
    primaryRole: ['operator', 'admin'],
    status: 'planned',
    description: 'Печать штрих-кодов на ТТН/упаковке.',
  },
  {
    key: 'correction-table',
    title: 'CorrectionTable',
    uxDr: 'UX-DR13',
    story: 'Story 10.2.7',
    primaryRole: ['operator'],
    status: 'planned',
    description: 'Таблица корректировки факт vs заказ (приёмка имущества).',
  },
  {
    key: 'expeditor-grouping-board',
    title: 'ExpeditorGroupingBoard',
    uxDr: 'UX-DR14',
    story: 'Story 10.2.8',
    primaryRole: ['operator'],
    status: 'planned',
    description: 'Доска группировки заявок на доставку (drag-n-drop).',
  },
  {
    key: 'ttn-print-preview',
    title: 'TTNPrintPreview',
    uxDr: 'UX-DR15',
    story: 'Story 10.2.9',
    primaryRole: ['operator', 'admin'],
    status: 'planned',
    description: 'Предпросмотр и печать ТТН.',
  },
  {
    key: 'warehouse-summary-grid',
    title: 'WarehouseSummaryGrid',
    uxDr: 'UX-DR16',
    story: 'Story 10.2.10',
    primaryRole: ['admin'],
    status: 'planned',
    description: 'Сводная таблица склада кооператива (admin-стол).',
  },
  {
    key: 'onboarding-cpp-gate',
    title: 'OnboardingCPPGate',
    uxDr: 'UX-DR17',
    story: 'Story 10.2.11',
    primaryRole: ['все'],
    status: 'planned',
    description: 'Пакет документов per-стол на онбординге (трёхуровневый онбординг расширений).',
  },
  {
    key: 'multi-channel-status',
    title: 'MultiChannelStatus',
    uxDr: 'UX-DR18',
    story: 'Story 10.2.12',
    primaryRole: ['все'],
    status: 'planned',
    description: 'Статус push / email / SMS (доставка нотификации пайщику).',
  },
  {
    key: 'ku-map-with-list',
    title: 'KUMapWithList',
    uxDr: 'Эпик 2 Story 2.3',
    story: 'Story 10.2.13',
    primaryRole: ['orderer', 'admin'],
    status: 'imported',
    description: 'Карта ПВЗ с синхронным выбором пин/список. Существующий виджет из widgets/KUMapWithList.',
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
