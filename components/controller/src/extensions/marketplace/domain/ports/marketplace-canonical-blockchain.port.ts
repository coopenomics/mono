import type { BranchContract, Ledger2Contract, MarketContract } from 'cooptypes';
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
   * requirement 76: заказ из обезличенного остатка склада кооператива.
   * Продавец — сам кооператив (offerer == coopname на цепи); Order рождается
   * сразу в `acceptcoop` (имущество уже на счёте 10 после первичной приёмки)
   * и идёт только через выдачу signiss1/signiss2. Один шаг ledger2:
   * o.mkt.lock (TRANSFER w.wal.share → w.mkt.order) — средства пайщика
   * блокируются в момент акцепта предложения/заказа.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  stockOrder(data: MarketContract.Actions.StockOrder.IStockOrder): Promise<TransactResult>;

  /**
   * requirement 76 (вопрос 4): списание уценки по заказу из остатка после
   * финализации выдачи — o.mkt.loss (NONE, Дт 91 / Кт 10) на разницу между
   * стоимостью прибытия выданного и фактической суммой выдачи. Вместе с
   * o.mkt.consum даёт выбытие со счёта 10 по полной стоимости прибытия.
   * Погашение накопленного на 91 (Дт 86 / Кт 91) — будущий процесс по
   * образцу списания скоропорта через совет.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  markdown(data: MarketContract.Actions.Markdown.IMarkdown): Promise<TransactResult>;

  /**
   * Story 4.3: backend cron закрывает один Order по таймауту цикла (или
   * pending-acceptance timeout). Per-Order: триггерит C++
   * `marketplace::expireorder` → o.mkt.unlock на total_cost + статус
   * Order'а на цепи active → cancelled.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  expireOrder(data: MarketContract.Actions.ExpireOrder.IExpireOrder): Promise<TransactResult>;

  /**
   * Закрытие выданного заказа после выхода гарантийного срока (cron-driven):
   * C++ `marketplace::closeorder` стирает запись заказа из RAM (терминал
   * жизненного цикла). Контракт отклоняет закрытие до выхода гарантийного
   * срока, при незавершённой выплате поставщику или открытом возврате.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  closeOrder(data: MarketContract.Actions.CloseOrder.ICloseOrder): Promise<TransactResult>;

  /**
   * Story 4.4: заказчик отменяет Order до акцепта поставщиком. Триггерит
   * C++ `marketplace::cancelorder` → `UNLOCK_ORDER` (o.mkt.unlock) на
   * `order.total_cost` + on-chain Order.status: ACTIVE → CANCELLED.
   * Сумма возвращается на `w.wal.member.available` пайщика-заказчика
   * (может быть потрачена пайщиком в членских программах).
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
   * Story 4.5: поставщик отказывается от одного Order'а до акцепта. C++:
   * `o.mkt.unlock` на `order.total_cost` (средства возвращаются на
   * `w.wal.member.available` пайщика-заказчика) + on-chain Order.status:
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
   * Per-Order транзакция:
   *
   *   1. Корректирующие операции (если факт ≠ заказ):
   *      - actual < ordered: `o.mkt.unlock(ordered_cost - fact_cost)` —
   *        снятие разницы резерва на `w.wal.member.available`.
   *      - actual > ordered: `o.mkt.lock(diff)` — добор разницы с паевого
   *        (TRANSFER w.wal.share → w.mkt.order, Дт 80 / Кт 86); при
   *        нехватке средств транзакция фейлится (L6 guard, FR25).
   *   2. Выдача: `o.mkt.consum(fact_cost)` — BURN w.mkt.order, Дт 86 / Кт 10.
   *
   * Статус Order'а: `ready_to_receive → received`; заполняются
   * `actual_quantity`, `fact_cost`, `issue_act_signiss2`, `warranty_until`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `orderer == order.orderer` и авторизацию `delivery_signer` для
   * `delivery_braname`. Подписи в `act.signatures` — `{delivery_signer, orderer}`.
   */
  signIss2(data: MarketContract.Actions.SignIss2.ISignIss2): Promise<TransactResult>;

  /**
   * Story 7.1 / FR29: пайщик подаёт заявление на гарантийный возврат.
   * Без ledger2-операций — создаётся on-chain `return_request` в статусе
   * `pendrev`, ставится двусторонняя связь `order.return_request_id`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет:
   * actor=order.orderer, order.status=received, warranty_until>now(),
   * photos.size()>0, actual_quantity ∈ (0, order.actual_quantity].
   */
  submRetrn(data: MarketContract.Actions.SubmRetrn.ISubmRetrn): Promise<TransactResult>;

  /**
   * Story 7.2 / FR31: председатель КУ удалённо одобряет очный визит.
   * Без ledger2-операций. Статус return_request: `pendrev → approvvisit`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `Branch::is_user_authorized(coopname, braname, signer)` (председатель /
   * trustee / trusted указанного КУ).
   */
  aprRetRem(data: MarketContract.Actions.AprRetRem.IAprRetRem): Promise<TransactResult>;

  /**
   * Story 7.2 / FR31: председатель КУ удалённо отказывает в возврате.
   * Без ledger2-операций. Статус: `pendrev → rejremote`; `reason_remote`
   * сохраняется для UI заказчика.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * авторизацию `signer` для `braname` + `reason.size() ∈ (0, 500]`.
   */
  rejRetRem(data: MarketContract.Actions.RejRetRem.IRejRetRem): Promise<TransactResult>;

  /**
   * Story 7.3 / 7.4 — FR32, FR33: председатель по результатам очного
   * осмотра принимает гарантийный возврат (compensating forward, AR9/AR14):
   *
   *   1. `o.mkt.return(fact_cost, orderer)` (ISSUE w.wal.member, Дт 10 / Кт 86) —
   *      восстанавливает `.available` на `w.wal.member` заказчика и возвращает
   *      имущество на склад КУ.
   *
   * Статус return_request: `approvvisit → accepted` (final). Order.status
   * остаётся `received` — возврат фиксируется отдельной сущностью.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * авторизацию `signer` для `braname` + статус заявления.
   */
  accRetrn(data: MarketContract.Actions.AccRetrn.IAccRetrn): Promise<TransactResult>;

  /**
   * Story 7.3 / FR32: председатель отказывает в возврате на очном
   * осмотре. Без ledger2-операций. Статус: `approvvisit → rejatku`;
   * `reason_visit` сохраняется для UI заказчика.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * авторизацию `signer` для `braname` + `reason.size() ∈ (0, 500]`.
   */
  rejRetrn(data: MarketContract.Actions.RejRetrn.IRejRetrn): Promise<TransactResult>;

  /**
   * Story 8.1 / FR37: backend вносит проект решения совета о списании
   * скоропорта. Без ledger2-операций — создаётся on-chain wroffprops в
   * статусе `proposed`. Тем же action'ом контракт сам ставит повестку:
   * inline `soviet::createagenda(type=mktwroff, callback_contract=marketplace,
   * confirm_callback=onmktwoauth, decline_callback=onmktwodecl)` от
   * `permission_level{marketplace, active}`. `statement` (подписанное
   * Заявление 1106) и `meta` форвардятся в createagenda. Backend createagenda
   * отдельно НЕ вызывает — кооператив не в contracts_whitelist.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  propWroff(data: MarketContract.Actions.PropWroff.IPropWroff): Promise<TransactResult>;

  /**
   * Story 8.4: backend исполняет одну позицию авторизованного проекта
   * списания. Per-item: `o.mkt.wroff` (Дт 86 / Кт 10); когда последняя
   * позиция исполнена, статус AUTHORIZED → EXECUTED. Backend проходит
   * цикл по `items[*].executed === false`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * статус проекта (AUTHORIZED) и авторизацию `signer` для
   * `items[item_index].braname`.
   */
  execWroff(data: MarketContract.Actions.ExecWroff.IExecWroff): Promise<TransactResult>;

  /**
   * Председатель кооперативного участка подтверждает фактическое списание
   * со склада своего КУ (ручной шаг стола ПВЗ). Закрывает все неисполненные
   * позиции участка `braname` за вызов, проводит `o.mkt.wroff` и якорит
   * подписанную Служебную записку о списании (registry 1111) в реестр
   * документов. Авторизация — кооператив (`require_auth(coopname)`); C++
   * проверяет, что `signer` уполномочен для `braname`.
   */
  confirmWroff(data: MarketContract.Actions.ConfirmWroff.IConfirmWroff): Promise<TransactResult>;

  // ── Экономика КУ (requirement b6): членский взнос и распределение ────

  /** Единая ставка членского взноса кооператива (администратор). */
  setFee(data: MarketContract.Actions.SetFee.ISetFee): Promise<TransactResult>;

  /** Ручное распределение средств общего кошелька КУ по весам (branch::distribute; председатель). */
  distribute(data: BranchContract.Actions.Distribute.IDistribute): Promise<TransactResult>;

  /** Вес участника распределения членских взносов КУ (branch::setweight). */
  setWeight(data: BranchContract.Actions.SetWeight.ISetweight): Promise<TransactResult>;

  /** Исключение участника из распределения (branch::delweight). */
  delWeight(data: BranchContract.Actions.DelWeight.IDelweight): Promise<TransactResult>;

  /** Перевод персональных средств доверенного в членский кошелёк «Стола заказов» (branch::convert). */
  convertBranchFunds(data: BranchContract.Actions.Convert.IConvert): Promise<TransactResult>;

  /** Заявка на материальную помощь доверенного (branch::createaid → gateway). */
  createAid(data: BranchContract.Actions.CreateAid.ICreateaid): Promise<TransactResult>;

  // ── Чтение on-chain состояния экономики КУ ───────────────────────────

  /** Singleton-конфигурация «Стола заказов» (единая ставка взноса); null — не настроена. */
  getEconomyConfig(coopname: string): Promise<MarketContract.Tables.Config.IMktConfig | null>;

  /** Реестр весов распределения (branch::weights). */
  getBranchWeights(coopname: string): Promise<BranchContract.Tables.Weights.IBranchWeight[]>;

  /** Агрегаты Σ весов (branch::weighttotals). */
  getBranchWeightTotals(coopname: string): Promise<BranchContract.Tables.WeightTotals.IBranchWeightTotal[]>;

  /** Заявки на материальную помощь (branch::aids). */
  listAids(coopname: string): Promise<BranchContract.Tables.Aids.IBranchAid[]>;

  /** L3-балансы кошельков экономики КУ (w.brn.person / w.brn.common) из ledger2. */
  listBranchWalletBalances(coopname: string): Promise<Ledger2Contract.Tables.UserWallets.IUserWallet[]>;
}

export const MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT = Symbol('MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT');
