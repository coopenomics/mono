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
   * Order'а. C++ marketplace::signchair выполняет ledger2-операцию
   * `o.mkt.purch` (Дт 10 / Кт 86 — имущество на склад КУ за счёт ЦФ),
   * переводит on-chain статус Order'а `supply_prepared → accepted_to_coop`
   * и устанавливает `current_warehouse_braname = accept_braname`.
   *
   * Locked Decision L12 / PR #389: o.mkt.payout вынесен из signchair в
   * отдельный action `marketplace::payout` (см. метод `payOut`); приёмка
   * на КУ закрывает только корреспонденцию 10/86, обязательство 86/51
   * (выплата поставщику) формируется отдельной транзакцией после
   * фактического банковского перевода кассиром.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `signer == председатель КУ`.
   */
  signChair(data: MarketContract.Actions.SignChair.ISignChair): Promise<TransactResult>;

  /**
   * E11 техдолг 598-16 / Locked Decision L12: инициация исходящей выплаты
   * поставщику по одному Order'у через контракт gateway. Триггерит C++
   * `marketplace::payout` → inline `gateway::createoutpay` — gateway
   * регистрирует запись в `outcomes` со статусом pending и привязанными
   * callback'ами `payconfirm` / `paydecline`. Ledger2-операция o.mkt.payout
   * (Дт 86 / Кт 51) применится позже в callback'е `payconfirm` после
   * фактического банковского перевода кассиром; backend сам callback не
   * вызывает — слушает delta через parser2 и обновляет
   * `marketplace_outgoing_payment_request.status` соответственно.
   *
   * `order.payout_status`: NONE/DECLINED → PENDING. Defence-in-depth от
   * двойной инициации — на уровне C++ guard.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  payOut(data: MarketContract.Actions.PayOut.IPayout): Promise<TransactResult>;

  /**
   * Story 6.1 / FR21: председатель КУ выдачи открывает выдачу первой
   * подписью АПП-выдачи. Без ledger2-операций. Per-Order: статус
   * `accepted_to_coop → ready_to_receive`, `current_warehouse_braname`
   * приравнивается `delivery_braname` (фиксация логистической передачи
   * на склад выдачи). Сохраняется `issue_act_signiss1` в Order row.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет,
   * что `signer` уполномочен для `delivery_braname` (председатель /
   * trustee / trusted).
   */
  signIss1(data: MarketContract.Actions.SignIss1.ISignIss1): Promise<TransactResult>;

  /**
   * Story 6.3 / FR24: заказчик закрывает выдачу финальной подписью.
   * Per-Order композитная транзакция через транзит 91:
   *
   *   1. Корректирующие операции (если факт ≠ заказ):
   *      - actual < ordered: `o.mkt.unblk(ordered_cost - fact_cost)` —
   *        возврат разницы на `w.mkt.member.available`.
   *      - actual > ordered: `o.wal.conv` (conditional) +
   *        `o.mkt.assign` (conditional) + `o.mkt.block(diff)` —
   *        доплата с паевого; при нехватке средств транзакция фейлится
   *        (L6 guard, FR25).
   *   2. Композитная пара выдачи: `o.mkt.consum(fact_cost)`
   *      (REVOKE, Дт 91 / Кт 10) + `o.mkt.consum2(fact_cost)`
   *      (NONE, Дт 86 / Кт 91) — закрытие транзита.
   *
   * Статус Order'а: `ready_to_receive → received`; заполняются
   * `actual_quantity`, `fact_cost`, `issue_act_signiss2`, `warranty_until`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `orderer == order.orderer` и авторизацию `delivery_signer` для
   * `delivery_braname`. Подписи в `act.signatures` — `{delivery_signer, orderer}`.
   */
  signIss2(data: MarketContract.Actions.SignIss2.ISignIss2): Promise<TransactResult>;
}

export const MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT = Symbol('MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT');
