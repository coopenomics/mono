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
}

export const MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT = Symbol('MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT');
