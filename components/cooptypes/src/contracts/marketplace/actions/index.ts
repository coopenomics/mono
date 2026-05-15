// Canonical actions контракта marketplace (Story 11.1, членская модель «Стола заказов»).
// Источник правды: components/contracts/build/contracts/marketplace/marketplace.abi
// Раскладка по процессам соответствует YAML-стандартам:
//   p.mkt.supply.standard.yaml / p.mkt.return.standard.yaml / p.mkt.wroff.standard.yaml

// ── p.mkt.supply (9 actions) — Stories Эпиков 4-5-6 ────────────────────

/**
 * Заказчик размещает заказ на товар из каталога (Story 4.1).
 * Серия: o.wal.conv (conditional) → o.mkt.assign (conditional) → o.mkt.block.
 */
export * as CreateOrder from './createOrder'

/**
 * Заказчик отменяет заказ до акцепта поставщиком (Story 4.4). Триггерит o.mkt.unblk.
 */
export * as CancelOrder from './cancelOrder'

/**
 * Backend закрывает Order по таймауту цикла отсечки (Story 4.3). Per-Order: o.mkt.unblk + cancellation.
 */
export * as ExpireOrder from './expireOrder'

/**
 * Поставщик акцептует один Order (Story 4.5). Без ledger2-операций — статус active → accepted.
 */
export * as AcceptOrder from './acceptOrder'

/**
 * Поставщик отказывается от одного Order'а до акцепта (Story 4.5). Per-Order: o.mkt.unblk + cancellation.
 */
export * as DeclineOrder from './declineOrder'

/**
 * Поставщик первой подписью на АПП приёмки фиксирует партию по одному Order'у (Story 5.3/5.4).
 * Параметр accept_braname указывает приёмный КУ.
 */
export * as SignSupp from './signSupp'

/**
 * Председатель / trustee приёмного КУ ставит закрывающую подпись на АПП приёмки (Story 5.3/5.4).
 * Per-Order: o.mkt.purch + o.mkt.payout (атомарно).
 */
export * as SignChair from './signChair'

/**
 * Председатель / trustee КУ выдачи открывает выдачу первой подписью АПП-выдачи (Story 6.1).
 */
export * as SignIss1 from './signIss1'

/**
 * Заказчик ставит финальную подпись АПП-выдачи (Story 6.3).
 * Per-Order с поддержкой actual_quantity ≠ ordered (Story 6.2).
 */
export * as SignIss2 from './signIss2'

// ── p.mkt.return (5 actions) — Stories Эпика 7 ─────────────────────────

/**
 * Пайщик подаёт заявление на гарантийный возврат (Story 7.1).
 */
export * as SubmRetrn from './submRetrn'

/**
 * Председатель удалённо одобряет очный визит (Story 7.2).
 */
export * as AprRetRem from './aprRetRem'

/**
 * Председатель удалённо отказывает (Story 7.2).
 */
export * as RejRetRem from './rejRetRem'

/**
 * Председатель принимает возврат на очном осмотре (Story 7.4).
 * Atomic: o.mkt.return + o.mkt.return2 (compensating forward).
 */
export * as AccRetrn from './accRetrn'

/**
 * Председатель отказывает на очном осмотре (Story 7.3).
 */
export * as RejRetrn from './rejRetrn'

// ── p.mkt.wroff (3 actions) — Stories Эпика 8 ──────────────────────────

/**
 * Backend / админ выносит проект списания на повестку совета (Story 8.1).
 */
export * as PropWroff from './propWroff'

/**
 * Совет исполняет одну позицию проекта списания (Story 8.3).
 * Per-item: o.mkt.wroff + o.mkt.wroff2 (атомарно).
 */
export * as ExecWroff from './execWroff'

/**
 * Совет отклоняет проект списания целиком (Story 8.3).
 */
export * as DeclWroff from './declWroff'

// ── service ────────────────────────────────────────────────────────────

/**
 * Заглушка миграции — donor-таблиц нет. Оставлена для совместимости с прежним ABI.
 */
export * as Migrate from './migrate'
