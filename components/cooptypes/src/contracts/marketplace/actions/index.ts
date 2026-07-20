// Canonical actions контракта marketplace (Story 11.1, членская модель «Стола заказов»).
// Источник правды: components/contracts/build/contracts/marketplace/marketplace.abi
// Раскладка по процессам соответствует YAML-стандартам:
//   p.mkt.supply.standard.yaml / p.mkt.return.standard.yaml / p.mkt.wroff.standard.yaml

// ── p.mkt.supply (12 actions) — Stories Эпиков 4-5-6 + E11 техдолг 598-16 ──

/**
 * Заказчик размещает заказ на товар из каталога (Story 4.1).
 * Серия: o.wal.conv (conditional) → o.mkt.assign (conditional) → o.mkt.block.
 */
export * as CreateOrder from './createOrder'

/**
 * Заказ имущества из обезличенного остатка склада кооператива (requirement 76).
 * Продавец — кооператив; Order рождается сразу в acceptcoop. Фондируется из
 * членских средств: o.mkt.lockm (тело) + o.mkt.lockmf (взнос).
 */
export * as StockOrder from './stockOrder'

/**
 * Конвертация паевого взноса в членский кошелёк «Стола заказов» (requirement 76):
 * o.mkt.conv (w.wal.share → w.mkt.member). Пополняет членские средства под заказ
 * со склада; выполняется перед stockorder, когда членских средств не хватает.
 */
export * as Convert from './convert'

/**
 * Списание уценки по заказу из остатка (requirement 76): o.mkt.loss (Дт 91 / Кт 10)
 * после финализации выдачи — выбытие со склада по полной стоимости прибытия.
 */
export * as Markdown from './markdown'

/**
 * Заказчик отменяет заказ до акцепта поставщиком (Story 4.4). Триггерит o.mkt.unblk.
 * Stock-ордер (продавец — кооператив) отменяется и в acceptcoop — до первой подписи акта выдачи.
 */
export * as CancelOrder from './cancelOrder'

/**
 * Backend закрывает Order по таймауту цикла отсечки (Story 4.3). Per-Order: o.mkt.unblk + cancellation.
 */
export * as ExpireOrder from './expireOrder'
export * as CloseOrder from './closeOrder'

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
 * Per-Order: только o.mkt.purch (Дт 10 / Кт 86). Выплата поставщику отделена в `PayOut`
 * (Locked Decision L12, E11 техдолг 598-16).
 */
export * as SignChair from './signChair'

/**
 * Backend инициирует исходящую выплату поставщику через gateway по одному Order'у
 * (E11 техдолг 598-16, Locked Decision L12). Inline-вызовом регистрирует запись в
 * gateway::outcomes со статусом pending; ledger2 здесь не двигается — Дт 86 / Кт 51
 * применится позже в callback'е `PayConfirm` после действия кассира.
 */
export * as PayOut from './payOut'

/**
 * Callback gateway::outcomplete — кассир подтвердил банковский перевод поставщику.
 * Auth: `_gateway`. Здесь применяется o.mkt.payout (Дт 86 / Кт 51); backend сам не
 * дёргает — слушает delta через parser2.
 */
export * as PayConfirm from './payConfirm'

/**
 * Callback gateway::outdecline — кассир отметил, что перевод не состоялся.
 * Auth: `_gateway`. Без ledger-движения; `order.payout_status` → DECLINED.
 */
export * as PayDecline from './payDecline'

/**
 * Председатель / trustee КУ выдачи открывает выдачу первой подписью АПП-выдачи (Story 6.1).
 */
export * as SignIss1 from './signIss1'

/**
 * Заказчик ставит финальную подпись АПП-выдачи (Story 6.3).
 * Per-Order с поддержкой actual_quantity ≠ ordered (Story 6.2).
 */
export * as SignIss2 from './signIss2'

/**
 * Единая ставка членского взноса кооператива (requirement b6, «Экономика КУ»).
 * Задаёт администратор; новые заказы блокируют взнос операцией o.mkt.fee.
 */
export * as SetFee from './setFee'

/**
 * Отсечка персонального распределения членского взноса КУ (requirement b6).
 * Меняет председатель КУ; применяется при финализации заказов в branch::distribute.
 */

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

// ── p.mkt.wroff (4 actions) — Stories Эпика 8 ──────────────────────────
// Канонический паттерн «решение совета»: propWroff (admin) +
// soviet::createagenda(type=mktwroff) → onMktWoAuth / onMktWoDecl (callback
// от soviet) → execWroff per-item (backend).

/**
 * Backend выносит проект списания на повестку совета (Story 8.1).
 */
export * as PropWroff from './propWroff'

/**
 * Callback от `soviet::exec` после авторизации Протокола (Story 8.4).
 * PROPOSED → AUTHORIZED, кладёт authorization2 в wroffprops.protocol.
 */
export * as OnMktWoAuth from './onMktWoAuth'

/**
 * Callback от `soviet::cancelexprd` или decline-эффекта (Story 8.4).
 * Терминал: стирает запись проекта из RAM, reason — в журнале действий.
 */
export * as OnMktWoDecl from './onMktWoDecl'

/**
 * Backend исполняет одну позицию авторизованного проекта (Story 8.4).
 * Per-item: o.mkt.wroff + o.mkt.wroff2 (атомарно).
 */
export * as ExecWroff from './execWroff'

/**
 * Председатель КУ подтверждает фактическое списание со склада своего участка
 * (ручной шаг стола ПВЗ), подписывая Служебную записку о списании (1111).
 * Закрывает все неисполненные позиции одного КУ за вызов.
 */
export * as ConfirmWroff from './confirmWroff'

// ── service ────────────────────────────────────────────────────────────

/**
 * Заглушка миграции — donor-таблиц нет. Оставлена для совместимости с прежним ABI.
 */
export * as Migrate from './migrate'
