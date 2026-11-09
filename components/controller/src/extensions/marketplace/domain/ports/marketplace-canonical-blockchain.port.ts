import type { BranchContract, FundContract, Ledger2Contract, MarketContract, SovietContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

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
 * Stories Эпика 5/6 → signSupp / signChair; выдача (компонент 68) → readyIssue / issueStmt / issueAct1 / issueAct2 / cancelIssue.
 * Stories Эпика 7 → submRetrn / aprRetRem / rejRetRem / accRetrn / rejRetrn / handBack.
 * Stories Эпика 8 → propWroff / execWroff / declWroff.
 */
/** Действие заказа в транзакции оформления корзины. */
export enum MarketplaceCheckoutOrderActionKind {
  /** Заказ у поставщика — `marketplace::createorder`. */
  CREATE_ORDER = 'createorder',
  /** Заказ из остатка склада кооператива — `marketplace::stockorder`. */
  STOCK_ORDER = 'stockorder',
}

export type MarketplaceCheckoutOrderAction =
  | { kind: MarketplaceCheckoutOrderActionKind.CREATE_ORDER; data: MarketContract.Actions.CreateOrder.ICreateOrder }
  | { kind: MarketplaceCheckoutOrderActionKind.STOCK_ORDER; data: MarketContract.Actions.StockOrder.IStockOrder };

/**
 * Оформление корзины одной транзакцией: перевод по заявлению 1110 (если
 * кошельков программы не хватило) и заказы всех строк в порядке плана.
 * Цепь проводит действия вместе или откатывает все — частичного оформления
 * и зависшего перевода не бывает (решение владельца 15.09.2026).
 */
export interface MarketplaceCheckoutChainInput {
  coopname: string;
  /** Трансляция на свободный паевой «Стола заказов» — первым действием; null, если транслировать нечего. */
  convert: MarketContract.Actions.Convert.IConvert | null;
  orders: MarketplaceCheckoutOrderAction[];
}

export interface MarketplaceCanonicalBlockchainPort {
  createOrder(data: MarketContract.Actions.CreateOrder.ICreateOrder): Promise<InnerTransactResult>;

  /** Трансляция по заявлению и заказы всех строк корзины одной транзакцией. */
  checkout(data: MarketplaceCheckoutChainInput): Promise<InnerTransactResult>;

  /**
   * requirement 76: заказ из обезличенного остатка склада кооператива.
   * Продавец — сам кооператив (offerer == coopname на цепи); Order рождается
   * сразу в `acceptcoop` (имущество уже на счёте 10 после первичной приёмки)
   * и идёт только через выдачу по саге (заявление → совет → акт). Фондируется
   * из свободного паевого пайщика: o.mkt.fee (обеспечительная часть,
   * w.mkt.share → w.mkt.fee) и o.mkt.lockp (тело, w.mkt.share → w.mkt.order);
   * недостающее приходит заранее трансляцией по заявлению 1110 (o.mkt.conv).
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  stockOrder(data: MarketContract.Actions.StockOrder.IStockOrder): Promise<InnerTransactResult>;

  /**
   * Трансляция паевого взноса из Цифрового кошелька на свободный паевой «Стола
   * заказов» по заявлению 1110 — только когда его не хватает (o.mkt.conv).
   * Оформление корзины шлёт её первым действием общей транзакции
   * (`checkout`); отдельным вызовом пользуются потоки с одним заказом. Сумма адресуется заказам
   * (`targets`): на каждый заказ идёт своя операция с его хэшем как
   * `process_hash`, поэтому трансляция видна первой операцией нитки того заказа,
   * который оплачивает. Заявление публикуется в реестр документов отдельным
   * пакетом — оно одно на всё оформление.
   */
  convert(data: MarketContract.Actions.Convert.IConvert): Promise<InnerTransactResult>;


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
  markdown(data: MarketContract.Actions.Markdown.IMarkdown): Promise<InnerTransactResult>;

  /**
   * Story 4.3: backend cron закрывает один Order по таймауту цикла (или
   * pending-acceptance timeout). Per-Order: триггерит C++
   * `marketplace::expireorder` → o.mkt.unlock на total_cost + статус
   * Order'а на цепи active → cancelled.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  expireOrder(data: MarketContract.Actions.ExpireOrder.IExpireOrder): Promise<InnerTransactResult>;

  /**
   * Закрытие выданного заказа после выхода гарантийного срока (cron-driven):
   * C++ `marketplace::closeorder` стирает запись заказа из RAM (терминал
   * жизненного цикла). Контракт отклоняет закрытие до выхода гарантийного
   * срока, при незавершённой выплате поставщику или открытом возврате.
   *
   * Авторизация — кооператив (`require_auth(coopname)`).
   */
  closeOrder(data: MarketContract.Actions.CloseOrder.ICloseOrder): Promise<InnerTransactResult>;

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
  cancelOrder(data: MarketContract.Actions.CancelOrder.ICancelOrder): Promise<InnerTransactResult>;

  /**
   * Story 4.5: поставщик акцептует один Order. Без ledger2-операций —
   * только смена on-chain статуса `active → accepted`. Backend для batch
   * консолидированной заявки (time/volume) проходит циклом per-Order;
   * для individual cycle_type вызывается один раз.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `offerer == order.offerer` (пайщик-поставщик владеет Offer'ом).
   */
  acceptOrder(data: MarketContract.Actions.AcceptOrder.IAcceptOrder): Promise<InnerTransactResult>;

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
  declineOrder(data: MarketContract.Actions.DeclineOrder.IDeclineOrder): Promise<InnerTransactResult>;

  /**
   * Story 5.3 / 5.4: первая подпись поставщика на АПП приёмки одного
   * Order'а (поле `act` — IDocument2 с подписью поставщика). C++
   * marketplace::signsupp переводит on-chain статус Order'а
   * `accepted → supply_prepared` и фиксирует акт в `agreements`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `signature in act.signatures` соответствие `offerer`.
   */
  signSupp(data: MarketContract.Actions.SignSupp.ISignSupp): Promise<InnerTransactResult>;

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
  signChair(data: MarketContract.Actions.SignChair.ISignChair): Promise<InnerTransactResult>;

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
  payOut(data: MarketContract.Actions.PayOut.IPayout): Promise<InnerTransactResult>;



  /**
   * Story 7.1 / FR29: пайщик подаёт заявление на гарантийный возврат.
   * Без ledger2-операций — создаётся on-chain `return_request` в статусе
   * `pendrev`, ставится двусторонняя связь `order.return_request_id`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет:
   * actor=order.orderer, order.status=received, warranty_until>now(),
   * photos.size()>0, actual_quantity ∈ (0, order.actual_quantity].
   */
  submRetrn(data: MarketContract.Actions.SubmRetrn.ISubmRetrn): Promise<InnerTransactResult>;

  /**
   * Story 7.2 / FR31: председатель КУ удалённо одобряет очный визит.
   * Без ledger2-операций. Статус return_request: `pendrev → approvvisit`.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * `Branch::is_user_authorized(coopname, braname, signer)` (председатель /
   * trustee / trusted указанного КУ).
   */
  aprRetRem(data: MarketContract.Actions.AprRetRem.IAprRetRem): Promise<InnerTransactResult>;

  /**
   * Story 7.2 / FR31: председатель КУ удалённо отказывает в возврате.
   * Без ledger2-операций. Статус: `pendrev → rejremote`; `reason_remote`
   * сохраняется для UI заказчика.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * авторизацию `signer` для `braname` + `reason.size() ∈ (0, 500]`.
   */
  rejRetRem(data: MarketContract.Actions.RejRetRem.IRejRetRem): Promise<InnerTransactResult>;

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
  accRetrn(data: MarketContract.Actions.AccRetrn.IAccRetrn): Promise<InnerTransactResult>;

  /**
   * Story 7.3 / FR32: председатель отказывает в возврате на очном
   * осмотре. Без ledger2-операций. Статус: `approvvisit → rejatku`;
   * `reason_visit` сохраняется для UI заказчика.
   *
   * Авторизация — кооператив (`require_auth(coopname)`); C++ проверяет
   * авторизацию `signer` для `braname` + `reason.size() ∈ (0, 500]`.
   */
  rejRetrn(data: MarketContract.Actions.RejRetrn.IRejRetrn): Promise<InnerTransactResult>;

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
  propWroff(data: MarketContract.Actions.PropWroff.IPropWroff): Promise<InnerTransactResult>;

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
  execWroff(data: MarketContract.Actions.ExecWroff.IExecWroff): Promise<InnerTransactResult>;

  /**
   * Председатель кооперативного участка подтверждает фактическое списание
   * со склада своего КУ (ручной шаг стола ПВЗ). Закрывает все неисполненные
   * позиции участка `braname` за вызов, проводит `o.mkt.wroff` и якорит
   * подписанную Служебную записку о списании (registry 1111) в реестр
   * документов. Авторизация — кооператив (`require_auth(coopname)`); C++
   * проверяет, что `signer` уполномочен для `braname`.
   */
  confirmWroff(data: MarketContract.Actions.ConfirmWroff.IConfirmWroff): Promise<InnerTransactResult>;

  // ── Экономика КУ (requirement b6): ставка обеспечительной части и распределение ────

  /** Единая ставка обеспечительной части паевого взноса кооператива (администратор). */
  // ── Паевая модель: выдача по заявлению, протоколу совета и акту (компонент 68) ──

  /** Оператор участка выдачи отметил поступление имущества: acceptcoop → readyrecv. */
  readyIssue(data: MarketContract.Actions.ReadyIssue.IReadyIssue): Promise<InnerTransactResult>;
  /** Заявление 1113 заказчика: readyrecv → issuepend + повестка совета mktissue. */
  issueStmt(data: MarketContract.Actions.IssueStmt.IIssueStmt): Promise<InnerTransactResult>;
  /** Первая подпись акта 1115 заказчиком: issueauth → issueact1. */
  issueAct1(data: MarketContract.Actions.IssueAct1.IIssueAct1): Promise<InnerTransactResult>;
  /** Закрывающая подпись акта председателем участка: issueact1 → received, все движения выдачи. */
  issueAct2(data: MarketContract.Actions.IssueAct2.IIssueAct2): Promise<InnerTransactResult>;
  /** Отмена начатой выдачи оператором: issueauth / issueact1 → readyrecv. */
  cancelIssue(data: MarketContract.Actions.CancelIssue.ICancelIssue): Promise<InnerTransactResult>;
  /** Оператор выдал имущество обратно после отказа совета или по истечении срока ожидания. */
  handBack(data: MarketContract.Actions.HandBack.IHandBack): Promise<InnerTransactResult>;

  // ── Коэффициент экономического участия (задачи 99D-22, 99D-33; процесс p.mkt.due) ──
  /**
   * Расчёт итога периода участка (marketplace::closeperiod): стоимость заказов и
   * обеспечительную часть контракт берёт из своего счётчика, узел передаёт факты
   * о расходах — план, записки, выплаченную помощь.
   */
  closePeriod(data: MarketContract.Actions.ClosePeriod.IClosePeriod): Promise<InnerTransactResult>;
  /** Стирание строки итога месяца из цепи (marketplace::delperiod). */
  deletePeriod(data: MarketContract.Actions.DelPeriod.IDelPeriod): Promise<InnerTransactResult>;
  /** Списание строки счётчика пайщика за период по ставкам итога (marketplace::chargeperiod): суммы — из цепи. */
  chargePeriod(data: MarketContract.Actions.ChargePeriod.IChargePeriod): Promise<InnerTransactResult>;
  /** Переходный перенос строки зеркала в счётчики списания (marketplace::migratedue); под потолком кошелька пайщика. */
  migrateDue(data: MarketContract.Actions.MigrateDue.IMigrateDue): Promise<InnerTransactResult>;
  /** Доля инициатора участка в экономии месяца (marketplace::setshares). */
  setShares(data: MarketContract.Actions.SetShares.ISetShares): Promise<InnerTransactResult>;
  /** Инициатор участка; пустое имя снимает назначение (marketplace::setinitiator). */
  setInitiator(data: MarketContract.Actions.SetInitiator.ISetInitiator): Promise<InnerTransactResult>;
  /** Потолок резерва социально-экономического обеспечения на получателя в месяц (branch::setaidlimit). */
  setAidLimit(data: BranchContract.Actions.SetAidLimit.ISetaidlimit): Promise<InnerTransactResult>;
  /** Длина периода предела материальной помощи, секунд; ноль — календарный месяц UTC (стенд ставит длину своего месяца). */
  setAidPeriod(data: BranchContract.Actions.SetAidPeriod.ISetaidperiod): Promise<InnerTransactResult>;
  /** Резерв получателя на участке (branch::setreserve). */
  setReserve(data: BranchContract.Actions.SetReserve.ISetreserve): Promise<InnerTransactResult>;
  /** Снятие резерва получателя (branch::delreserve). */
  deleteReserve(data: BranchContract.Actions.DelReserve.IDelreserve): Promise<InnerTransactResult>;

  // ── p.mkt.claim — гарантийная претензия поставщику (99D-13) ──
  /** Поставщик признал претензию: o.mkt.admit, долг к удержанию из выплат. Несогласие в цепь не пишется. */
  admitClaim(data: MarketContract.Actions.AdmitClaim.IAdmitClaim): Promise<InnerTransactResult>;
  /**
   * Решение совета по хэшу повестки (order_hash / request_hash) — источник
   * номера решения для протокола и журнала саги. `null` — повестка ещё не
   * материализована в цепи.
   */
  findCouncilDecisionByHash(coopname: string, hash: string): Promise<SovietContract.Tables.Decisions.IDecision | null>;

  setFee(data: MarketContract.Actions.SetFee.ISetFee): Promise<InnerTransactResult>;

  /** Ручное распределение средств общего кошелька КУ по весам (branch::distribute; председатель). */
  distribute(data: BranchContract.Actions.Distribute.IDistribute): Promise<InnerTransactResult>;

  /** Вес участника распределения членских взносов КУ (branch::setweight). */
  setWeight(data: BranchContract.Actions.SetWeight.ISetweight): Promise<InnerTransactResult>;

  /** Исключение участника из распределения (branch::delweight). */
  delWeight(data: BranchContract.Actions.DelWeight.IDelweight): Promise<InnerTransactResult>;


  /** Заявка на материальную помощь доверенного (branch::createaid → gateway). */
  createAid(data: BranchContract.Actions.CreateAid.ICreateaid): Promise<InnerTransactResult>;

  /** Подача расхода участка в шасси расходов (branch::createexp). */
  createBranchExpense(data: BranchContract.Actions.CreateExp.ICreateexp): Promise<InnerTransactResult>;

  // ── Чтение on-chain состояния экономики КУ ───────────────────────────

  /** Singleton-конфигурация «Стола заказов» (единая ставка взноса); null — не настроена. */
  getEconomyConfig(coopname: string): Promise<MarketContract.Tables.Config.IMktConfig | null>;

  // Таблицы, которые растут с числом пайщиков и участков, читаются по индексу:
  // узел отдаёт только строки участка, пайщика или хэша, полного чтения нет.

  /** Веса распределения участка (branch::weights) — по индексу участка. */
  getBranchWeights(coopname: string, braname: string): Promise<BranchContract.Tables.Weights.IBranchWeight[]>;

  /** Агрегаты Σ весов участка (branch::weighttotals) — по индексу участка. */
  getBranchWeightTotals(coopname: string, braname: string): Promise<BranchContract.Tables.WeightTotals.IBranchWeightTotal[]>;

  /**
   * Заявления на материальную помощь (branch::aids): одного получателя — по
   * индексу получателя; без имени — все заявления в работе для стола
   * администратора (выплаченные и отклонённые строки цепь стирает).
   */
  listAids(coopname: string, username?: string): Promise<BranchContract.Tables.Aids.IBranchAid[]>;
  /** Накопитель материальной помощи получателя за календарный месяц по UTC (branch::aidmonths); null — заявлений не было. */
  getAidMonth(coopname: string, username: string): Promise<BranchContract.Tables.AidMonths.IBranchAidmonth | null>;

  /**
   * Кошелёк пайщика либо участка в ledger2 по имени кошелька (w.brn.person,
   * w.brn.common, w.mkt.invest, w.mkt.due) — по индексу владельца; null —
   * строки кошелька ещё нет.
   */
  getUserWallet(coopname: string, walletName: string, username: string): Promise<Ledger2Contract.Tables.UserWallets.IUserWallet | null>;

  // ── Чтение таблиц коэффициента экономического участия (задача 99D-22) ──
  /** Итоги месяцев участка, которые ещё лежат в цепи (marketplace::kuperiods), — по индексу участка; строк не больше двух. */
  listBranchPeriods(coopname: string, braname: string): Promise<MarketContract.Tables.Periods.IKuPeriod[]>;
  /** Итоги всех участков кооператива, которые ещё лежат в цепи, — не больше двух строк на участок. */
  listAllBranchPeriods(coopname: string): Promise<MarketContract.Tables.Periods.IKuPeriod[]>;
  /**
   * Счётчики участков за периоды списания (marketplace::kucounters) — все строки
   * кооператива: по строке на участок и открытый период, стираются расчётом итога.
   */
  listDueCounters(coopname: string): Promise<MarketContract.Tables.Counters.IKuCounter[]>;
  /** Счётчики пайщиков участка за все открытые периоды (marketplace::kudues) — по индексу участка. */
  listBranchDues(coopname: string, braname: string): Promise<MarketContract.Tables.Dues.IKuDue[]>;
  /** Счётчики пайщика по всем участкам (marketplace::kudues) — по индексу пайщика; единицы строк. */
  listMemberDues(coopname: string, username: string): Promise<MarketContract.Tables.Dues.IKuDue[]>;
  /** В цепи есть хоть одна строка счётчика пайщика — счётчики уже ведутся (переходный перенос не нужен). */
  hasAnyDues(coopname: string): Promise<boolean>;
  /** Назначенный инициатор участка (marketplace::initiators) — по ключу участка; null — не назначен. */
  getInitiator(coopname: string, braname: string): Promise<MarketContract.Tables.Initiators.IMktInitiator | null>;
  /** Резерв социально-экономического обеспечения участка по получателям (branch::reserves) — по индексу участка. */
  listBranchReserves(coopname: string, braname: string): Promise<BranchContract.Tables.Reserves.IBranchReserve[]>;
  /** Потолок резерва на получателя в месяц (branch::brnconfig); null — не задан. */
  getBranchConfig(coopname: string): Promise<BranchContract.Tables.BranchConfig.IBranchConfig | null>;
  /** Фонды накопления кооператива с процентами и кошельками (fund::funds, вид `accum`). */
  listAccumulationFunds(coopname: string): Promise<FundContract.Tables.Funds.IFund[]>;

  // ── Инвестиционный этап кооперативного участка (задача 99D-30) ──
  /** Договор участия в хозяйственной деятельности (marketplace::signinvagr). */
  signInvestAgreement(data: MarketContract.Actions.SignInvAgr.ISignInvAgr): Promise<InnerTransactResult>;
  /** Паевой взнос деньгами: трансляция паевого взноса в договор участия (marketplace::investmoney). */
  investMoney(data: MarketContract.Actions.InvestMoney.IInvestMoney): Promise<InnerTransactResult>;
  /** Заявление о паевом взносе имуществом в участок (marketplace::createiprop). */
  createInvestProperty(data: MarketContract.Actions.CreateIProp.ICreateIProp): Promise<InnerTransactResult>;
  /** Одобрение заявления председателем участка и повестка совета (marketplace::approveiprop). */
  approveInvestProperty(data: MarketContract.Actions.ApproveIProp.IApproveIProp): Promise<InnerTransactResult>;
  /** Отказ председателя участка до совета (marketplace::declineiprop). */
  declineInvestProperty(data: MarketContract.Actions.DeclineIProp.IDeclineIProp): Promise<InnerTransactResult>;
  /** Акт приёма-передачи: подпись вносящего (marketplace::act1iprop). */
  signInvestPropertyAct1(data: MarketContract.Actions.Act1IProp.IAct1IProp): Promise<InnerTransactResult>;
  /** Трансляция возвращённого паевого взноса в главный паевой; сумму считает контракт (marketplace::claiminv). */
  claimInvestment(data: MarketContract.Actions.ClaimInv.IClaimInv): Promise<InnerTransactResult>;
  /** Договор участия пайщика — по первичному ключу; null — не подписан. */
  getInvestAgreement(coopname: string, username: string): Promise<MarketContract.Tables.InvAgreements.IMktInvAgreement | null>;
  /** Паевые взносы инициаторов участка и счётчик возврата — по первичному ключу; null — паевых взносов нет. */
  getInvestBranch(coopname: string, braname: string): Promise<MarketContract.Tables.InvBranches.IMktInvBranch | null>;
  /** Инициаторы участка — по индексу участка. */
  listBranchInvestors(coopname: string, braname: string): Promise<MarketContract.Tables.Investors.IMktInvestor[]>;
  /** Паевые взносы пайщика во все участки — по индексу пайщика. */
  listUserInvestments(coopname: string, username: string): Promise<MarketContract.Tables.Investors.IMktInvestor[]>;
  /** Заявления на имущество участка до второй подписи акта — по индексу участка. */
  listBranchInvestProperties(coopname: string, braname: string): Promise<MarketContract.Tables.InvProps.IMktInvProp[]>;
  /** Заявление на имущество по хэшу паевого взноса; null — нет (принято или отклонено). */
  getInvestProperty(coopname: string, hash: string): Promise<MarketContract.Tables.InvProps.IMktInvProp | null>;
}

export const MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT = Symbol('MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT');
