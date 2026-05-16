import type { MarketContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

/**
 * Story 4.1: canonical blockchain port для marketplace процессов
 * p.mkt.supply / p.mkt.return / p.mkt.wroff (Story 11.1 / PR #375 +
 * PR #385 TS-foundation).
 *
 * Каждый метод оборачивает один canonical action; авторизация
 * каждого action идёт от кооператива (`require_auth(coopname)`),
 * пайщик аутентифицируется на уровне application service через
 * core-сессию.
 *
 * Stories Эпика 4 расширяют этот port по мере подключения actions:
 *  - Story 4.1 → createOrder
 *  - Story 4.4 → cancelOrder
 *  - Story 4.3 → expireOrder (cron-driven)
 *  - Story 4.5 → acceptOrder / declineOrder
 *
 * Stories Эпика 5/6 → signSupp / signChair / signIss1 / signIss2.
 * Stories Эпика 7 → submRetrn / aprRetRem / rejRetRem / accRetrn / rejRetrn.
 * Stories Эпика 8 → propWroff / execWroff / declWroff.
 */
export interface MarketplaceCanonicalBlockchainPort {
  createOrder(data: MarketContract.Actions.CreateOrder.ICreateOrder): Promise<TransactResult>;

  /**
   * Story 4.3: backend cron закрывает один Order по таймауту цикла (или
   * pending-acceptance timeout). Per-Order: триггерит C++
   * `marketplace::expireorder` → o.mkt.unblk на total_cost + статус
   * Order'а на цепи active → cancelled.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  expireOrder(data: MarketContract.Actions.ExpireOrder.IExpireOrder): Promise<TransactResult>;

  /**
   * Story 4.4: заказчик отменяет Order до акцепта поставщиком. Триггерит
   * C++ `marketplace::cancelorder` → серия `UNBLOCK_ON_CANCEL` (o.mkt.unblk)
   * на `order.total_cost` + on-chain Order.status: ACTIVE → CANCELLED.
   * Сумма остаётся на `w.mkt.member.available` пайщика-заказчика (может
   * быть потрачена на следующий заказ или явно выведена `o.mkt.recall`).
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ дополнительно
   * проверяет `actor == order.orderer` через параметр (passed-in name).
   */
  cancelOrder(data: MarketContract.Actions.CancelOrder.ICancelOrder): Promise<TransactResult>;

  /**
   * Story 4.5: поставщик акцептует один Order. Без ledger2-операций —
   * только смена on-chain статуса `active → accepted`. Backend для batch
   * консолидированной заявки (time/volume) проходит циклом per-Order;
   * для individual cycle_type вызывается один раз.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `offerer == order.offerer` (пайщик-поставщик владеет Offer'ом).
   */
  acceptOrder(data: MarketContract.Actions.AcceptOrder.IAcceptOrder): Promise<TransactResult>;

  /**
   * Story 4.5: поставщик отказывается от одного Order'а до акцепта. C++
   * серия: `o.mkt.unblk` на `order.total_cost` (средства возвращаются на
   * `w.mkt.member.available` пайщика-заказчика) + on-chain Order.status:
   * active → cancelled. Backend для batch консолидированной заявки
   * (time/volume) проходит циклом per-Order; для individual / open_pool
   * decline вызывается один раз.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `offerer == order.offerer`.
   */
  declineOrder(data: MarketContract.Actions.DeclineOrder.IDeclineOrder): Promise<TransactResult>;

  /**
   * Story 5.3 / 5.4: первая подпись поставщика на АПП приёмки одного
   * Order'а (поле `act` — IDocument2 с подписью поставщика). C++
   * marketplace::signsupp переводит on-chain статус Order'а
   * `accepted → supply_prepared` и фиксирует акт в `agreements`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `signature in act.signatures` соответствие `offerer`.
   */
  signSupp(data: MarketContract.Actions.SignSupp.ISignSupp): Promise<TransactResult>;

  /**
   * Story 5.6: закрывающая подпись председателя КУ на АПП приёмки одного
   * Order'а. C++ marketplace::signchair триггерит атомарную композитную
   * серию `o.mkt.purch` (Дт 10 / Кт 86 — имущество на склад КУ за счёт
   * ЦФ) + `o.mkt.payout` (TRANSFER, Дт 86 / Кт 51 — закрытие обязательства
   * перед поставщиком). Переводит on-chain статус Order'а
   * `supply_prepared → accepted_to_coop` и устанавливает
   * `current_warehouse_braname = accept_braname`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `signer == председатель КУ`.
   */
  signChair(data: MarketContract.Actions.SignChair.ISignChair): Promise<TransactResult>;
}

export const MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT = Symbol('MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT');
