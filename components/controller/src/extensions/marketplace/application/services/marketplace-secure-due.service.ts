import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Ledger2Contract } from 'cooptypes';
import { Workflows } from '@coopenomics/notifications';
import {
  ACCOUNT_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  type IAccountPort,
  type ILoggerPort,
  type INotificationPort,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
import { AmountFormatterUtils, TableStore, chainErrorCode, isNull, lessOrEqual, lessThan, moreThan, notNull, oneOf, platformSettings, standNextPeriodStart, standPeriodKey, isStandWorkerTurn } from '@coopenomics/extension-kit';
import { MARKETPLACE_SECURE_DUE_STORE } from '../../infrastructure/database/marketplace-stores';
import { MarketplaceSecureDueRunQueries } from '../../infrastructure/database/marketplace-secure-due-run.queries';
import { periodBounds } from '../shared/period-bounds';
import { MarketplaceSecureDueEntity } from '../../infrastructure/entities/marketplace-secure-due.entity';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_RETURN_CLAIM_REPOSITORY,
  type MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import { MarketplacePeriodService } from './marketplace-period.service';
import { MARKETPLACE_DUE_WALLET } from './marketplace-convert.service';
import type { MarketplaceBranchPeriodEntity } from '../../infrastructure/entities/marketplace-branch-period.entity';
import { MarketplaceSecurePartState, type MarketplaceSecurePartDTO } from '../dto/marketplace-secure-part.dto';
import { MarketplaceOrderStatuses, type MarketplaceOrderStatus } from '../../domain/entities/marketplace-order.types';

/** Заказ закрыт без получения: обеспечительная часть вернулась на свободный паевой. */
const ORDER_CLOSED_WITHOUT_ISSUE: ReadonlySet<MarketplaceOrderStatus> = new Set<MarketplaceOrderStatus>([
  MarketplaceOrderStatuses.CANCELLED_BY_ORDERER,
  MarketplaceOrderStatuses.CANCELLED_BY_SUPPLIER,
  MarketplaceOrderStatuses.RETURNED,
]);

/** Операции ledger2, которые двигают кошелёк обеспечительной части к списанию `w.mkt.due`. */
export enum MarketplaceSecureDueOperation {
  /** Факт обеспечительной части выданного заказа и удержанная половина при отказе — к списанию. */
  TO_DUE = 'o.mkt.todue',
  /** Удержанная половина тела при отказе от получения — к списанию. */
  PENALTY = 'o.mkt.penal',
  /** Гарантийный возврат: обеспечительная часть за возвращённое — обратно на свободный паевой. */
  UNDUE = 'o.mkt.undue',
  /** Списание в членский взнос по условиям ЦПП. */
  CHARGE = 'o.mkt.charge',
  /** Выход пайщика: остаток списывается немедленно. */
  EXIT = 'o.mkt.exfee',
  /** Факт выдачи — стоимость заказа, основание деления списания по ставкам итога месяца (задача 99D-22). */
  CONSUM = 'o.mkt.consum',
  /** Возврат части обеспечительной части пайщику по итогу месяца участка (задача 99D-22). */
  RETURN_DUE = 'o.mkt.retdue',
}

/** Что делает операция с остатком строки: списывает, возвращает пайщику либо просто уменьшает. */
type ReduceKind = 'charged' | 'returned' | 'none';

/** Сводка списаний одного пайщика за прогон — для письма. */
interface ChargedSummary {
  /** Списано в членский взнос: участку, в фонды и инициатору вместе. */
  units: bigint;
  /** Возвращено пайщику на свободный паевой. */
  returned: bigint;
  orders: number;
  /** Ставка списания участка за месяц, проценты с двумя знаками. */
  rate: string;
}

/** Накопитель списанного по пайщикам за прогон: одно письмо на пайщика. */
class ChargedCollector {
  charged = 0;
  readonly byUser = new Map<string, ChargedSummary>();

  note(row: MarketplaceSecureDueEntity, units: bigint, returned: bigint, rate: string): void {
    this.charged++;
    const acc = this.byUser.get(row.username) ?? { units: 0n, returned: 0n, orders: 0, rate };
    this.byUser.set(row.username, { units: acc.units + units, returned: acc.returned + returned, orders: acc.orders + 1, rate: acc.rate });
  }
}

/** Ставка списания удержаний и остатков без итога месяца: вся сумма участку. */
const FULL_RATE_PERCENT = '100.00';

/** Шаг крона списания в работе — час. */
const CHARGE_PACE_SECONDS = 60 * 60;

/**
 * Сколько транзакций списания крон отправляет за проход — защита от лавины
 * транзакций. Итог месяца считается по всем строкам прогона, предел касается
 * только отправки: остальные строки списывает следующий проход.
 */
const CHARGE_BATCH_LIMIT = 200;

/** Начала строк журнала узла о списании: удержание при отказе и заказ по ставкам итога месяца. */
const LOG_CHARGE_DUE = 'Списание обеспечительной части'; // i18n-ignore: строка журнала узла, не текст интерфейса
const LOG_CHARGE_PERIOD = 'Списание по итогу месяца'; // i18n-ignore: строка журнала узла, не текст интерфейса

/** Отказ контракта, когда на кошельке к списанию меньше заявленного. */
const DUE_EXCEEDS = 'MARKETPLACE_DUE_EXCEEDS';

/** Операция ledger2, разобранная из события цепи. */
interface AppliedOperation {
  coopname: string;
  username: string;
  /** Хэш процесса в нижнем регистре: заказа, а у гарантийного возврата — заявления. */
  hash: string;
  units: bigint;
  blockTime: Date;
  sequence: string;
}

/** Более поздний из двух моментов; пустой не участвует. */
function laterOf(a: Date | null | undefined, b: Date): Date {
  return a && a > b ? a : b;
}

/**
 * Номер расчётного месяца: в работе — календарный месяц в часовом поясе
 * кооператива (год × 12 + месяц), на стенде со сжатым временем — отрезок
 * длиной `STAND_MONTH_SECONDS` (шкала времени стенда в `extension-kit`).
 */
export function monthKey(date: Date, timeZone: string): number {
  return standPeriodKey(date, timeZone);
}

/**
 * Обеспечительная часть паевого взноса к списанию (задача 99D-18, решение
 * владельца 31.10.2026).
 *
 * При заказе пайщик сверх стоимости имущества вносит обеспечительную часть —
 * паевой взнос по ставке кооператива. На выдаче её факт ложится на кошелёк
 * пайщика к списанию `w.mkt.due`; на этот же кошелёк ложится удержание при
 * отказе от получения. Членским взносом участка она становится только при
 * списании по условиям ЦПП, без подписи пайщика: первого числа месяца,
 * следующего за окончанием гарантийного срока заказа (часовой пояс
 * кооператива). Пока гарантия идёт, гарантийный возврат возвращает её на
 * свободный паевой без обратных проводок.
 *
 * Контракт не хранит, кому и когда списывать: десятки тысяч строк на месяц в
 * оперативной памяти цепи держать нельзя. Учёт ведёт узел — таблица
 * `marketplace_secure_due`, строка на заказ. Суммы в неё пишет слушатель
 * операций ledger2 из того, что провёл контракт; узел их не вычисляет. Крон
 * зовёт `chargedue` по каждой созревшей строке, контракт держит потолок —
 * не больше остатка кошелька пайщика.
 *
 * Коэффициент экономического участия (следующая задача) делит сумму внутри
 * `chargedue` на контракте; узел продолжит называть сумму-основание.
 */
@Injectable()
export class MarketplaceSecureDueService {
  private running = false;

  constructor(
    @Inject(MARKETPLACE_SECURE_DUE_STORE)
    private readonly dueStore: TableStore<MarketplaceSecureDueEntity>,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    private readonly claimRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly periodService: MarketplacePeriodService,
    private readonly runQueries: MarketplaceSecureDueRunQueries
  ) {
    this.logger.setContext(MarketplaceSecureDueService.name);
  }

  // ── Учёт по операциям контракта ──────────────────────────────────────

  /**
   * Операции учёта идут строго по очереди, в порядке цепи. Шина выпускает
   * действия одного блока разом и слушателей не ждёт, а одна транзакция несёт
   * по заказу сразу две операции: выдача — стоимость и постановку к списанию,
   * списание по итогу месяца — списанную и возвращённую части. Обе читают и
   * пишут одну строку; без очереди вторая вставка падала по ключу, а второе
   * обновление затирало первое (журнал полигона 04.11.2026: 32 потерянные
   * операции) — строка оставалась без суммы к списанию либо без стоимости.
   */
  private applyQueue: Promise<void> = Promise.resolve();

  @OnEvent(`action::${Ledger2Contract.contractName.production}::${Ledger2Contract.Actions.Apply.actionName}`)
  onLedgerApply(action: InnerChainActionRecord): Promise<void> {
    const run = this.applyQueue.then(async () => {
      try {
        await this.applyOperation(action);
      } catch (err: any) {
        this.logger.error(`Учёт обеспечительной части: операция ${action.global_sequence} не учтена (${err.message})`, err.stack);
      }
    });
    this.applyQueue = run;
    return run;
  }

  async applyOperation(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as Ledger2Contract.Actions.Apply.IApply;
    const code = String(data?.operation_code ?? '') as MarketplaceSecureDueOperation;
    if (!Object.values(MarketplaceSecureDueOperation).includes(code)) return;
    const op: AppliedOperation = {
      coopname: String(data.coopname),
      username: String(data.username),
      hash: String(data.process_hash).toLowerCase(),
      units: this.economyService.assetToUnits(String(data.amount)),
      blockTime: action.block_time ? new Date(action.block_time) : new Date(),
      sequence: String(action.global_sequence ?? '0'),
    };
    await this.handlers[code](op);
  }

  /** Обработчик на каждую операцию — без ветвлений в общем методе. */
  private readonly handlers: Record<MarketplaceSecureDueOperation, (op: AppliedOperation) => Promise<void>> = {
    [MarketplaceSecureDueOperation.TO_DUE]: (op) => this.accrue(op),
    [MarketplaceSecureDueOperation.PENALTY]: (op) => this.accrue(op),
    [MarketplaceSecureDueOperation.CHARGE]: (op) => this.reduce(op.hash, op, 'charged'),
    [MarketplaceSecureDueOperation.UNDUE]: (op) => this.reduceByClaim(op),
    [MarketplaceSecureDueOperation.EXIT]: (op) => this.settleOnExit(op),
    [MarketplaceSecureDueOperation.CONSUM]: (op) => this.setBase(op),
    [MarketplaceSecureDueOperation.RETURN_DUE]: (op) => this.reduce(op.hash, op, 'returned'),
  };

  /**
   * К списанию по заказу. Выданный заказ созревает к концу гарантийного срока,
   * удержание при отказе — сразу: гарантии по нему нет.
   */
  private async accrue(op: AppliedOperation): Promise<void> {
    const order_hash = op.hash;
    const row = await this.dueStore.findOne({ order_hash });
    if (row && this.alreadyApplied(row, op.sequence)) return;
    const { braname, due_from } = await this.orderTerms(op);
    if (!row) {
      await this.dueStore.insert({
        order_hash,
        coopname: op.coopname,
        username: op.username,
        braname,
        due_amount: this.toDecimal(op.units),
        charged_amount: this.toDecimal(0n),
        base_amount: this.toDecimal(0n),
        returned_amount: this.toDecimal(0n),
        due_from,
        charged_at: null,
        last_sequence: op.sequence,
      });
      return;
    }
    await this.dueStore.update(
      { order_hash },
      {
        due_amount: this.toDecimal(this.fromDecimal(row.due_amount) + op.units),
        // Позднее созревание побеждает: строка списывается целиком.
        due_from: laterOf(row.due_from, due_from),
        charged_at: null,
        // Закрытая строка открывается заново: прежние отметки прогона к новой сумме не относятся.
        ...(row.charged_at ? { run_period: null, charge_sent_at: null } : {}),
        last_sequence: op.sequence,
      }
    );
  }

  /**
   * Стоимость заказа — факт выдачи по операции o.mkt.consum (задача 99D-22):
   * основание деления списания по ставкам итога месяца. Выдача и постановка
   * к списанию идут одной транзакцией в любом порядке: строка заводится тем,
   * что пришло первым. У удержания при отказе выдачи нет — стоимость ноль, и
   * оно списывается целиком участку.
   */
  private async setBase(op: AppliedOperation): Promise<void> {
    const order_hash = op.hash;
    const row = await this.dueStore.findOne({ order_hash });
    if (row && this.alreadyApplied(row, op.sequence)) return;
    if (!row) {
      const { braname, due_from } = await this.orderTerms(op);
      await this.dueStore.insert({
        order_hash,
        coopname: op.coopname,
        username: op.username,
        braname,
        due_amount: this.toDecimal(0n),
        charged_amount: this.toDecimal(0n),
        base_amount: this.toDecimal(op.units),
        returned_amount: this.toDecimal(0n),
        due_from,
        charged_at: null,
        last_sequence: op.sequence,
      });
      return;
    }
    await this.dueStore.update(
      { order_hash },
      { base_amount: this.toDecimal(this.fromDecimal(row.base_amount) + op.units), last_sequence: op.sequence }
    );
  }

  /** Участок выдачи и момент созревания из заказа в базе узла. */
  private async orderTerms(op: AppliedOperation): Promise<{ braname: string; due_from: Date }> {
    const order = await this.orderRepo.findByOrderHash(op.coopname, op.hash);
    if (!order) {
      this.logger.error(`Учёт обеспечительной части: заказ ${op.hash} не найден в базе узла — участок списания неизвестен.`);
      return { braname: '', due_from: op.blockTime };
    }
    return { braname: order.delivery_braname, due_from: laterOf(order.warranty_until, op.blockTime) };
  }

  /** Гарантийный возврат: хэш процесса — хэш заявления, заказ берётся из заявления. */
  private async reduceByClaim(op: AppliedOperation): Promise<void> {
    const claim = await this.claimRepo.findByRequestHash(op.coopname, op.hash);
    if (!claim) {
      this.logger.error(`Учёт обеспечительной части: заявление на возврат ${op.hash} не найдено — возврат ${this.toDecimal(op.units)} не учтён.`);
      return;
    }
    await this.reduce(claim.order_hash.toLowerCase(), op, 'none');
  }

  /**
   * Списание, возврат пайщику по итогу месяца и гарантийный возврат уменьшают
   * остаток к списанию; списанное и возвращённое копятся в своих полях.
   */
  private async reduce(order_hash: string, op: AppliedOperation, kind: ReduceKind): Promise<void> {
    const row = await this.dueStore.findOne({ order_hash });
    if (!row) {
      this.logger.error(`Учёт обеспечительной части: по заказу ${order_hash} строки нет — операция на ${this.toDecimal(op.units)} не учтена.`);
      return;
    }
    if (this.alreadyApplied(row, op.sequence)) return;
    const before = this.fromDecimal(row.due_amount);
    if (before < op.units) {
      this.logger.error(`Учёт обеспечительной части: по заказу ${order_hash} списано больше учтённого (${this.toDecimal(op.units)} при остатке ${row.due_amount}).`);
    }
    const due = before > op.units ? before - op.units : 0n;
    await this.dueStore.update(
      { order_hash },
      {
        due_amount: this.toDecimal(due),
        charged_amount: kind === 'charged' ? this.toDecimal(this.fromDecimal(row.charged_amount) + op.units) : row.charged_amount,
        returned_amount: kind === 'returned' ? this.toDecimal(this.fromDecimal(row.returned_amount) + op.units) : row.returned_amount,
        charged_at: due === 0n ? op.blockTime : null,
        last_sequence: op.sequence,
      }
    );
  }

  /** Выход пайщика: контракт списал весь остаток кошелька — все его строки закрыты. */
  private async settleOnExit(op: AppliedOperation): Promise<void> {
    const rows = await this.dueStore.find({ coopname: op.coopname, username: op.username, charged_at: isNull() });
    for (const row of rows) {
      if (this.alreadyApplied(row, op.sequence)) continue;
      await this.dueStore.update(
        { order_hash: row.order_hash },
        {
          charged_amount: this.toDecimal(this.fromDecimal(row.charged_amount) + this.fromDecimal(row.due_amount)),
          due_amount: this.toDecimal(0n),
          charged_at: op.blockTime,
          last_sequence: op.sequence,
        }
      );
    }
  }

  private alreadyApplied(row: MarketplaceSecureDueEntity, sequence: string): boolean {
    try {
      return BigInt(sequence) <= BigInt(row.last_sequence || '0');
    } catch {
      return false;
    }
  }

  // ── Обеспечительная часть в карточке заказа ─────────────────────────

  /**
   * Сколько, в каком состоянии и когда спишется — по строке учёта узла.
   * Строки нет: до получения обеспечительная часть в резерве, у отменённого
   * заказа — возвращена. У полученного заказа прежней модели (с членским
   * взносом при заказе) строки нет и блока нет — `null`.
   */
  async securePartOf(order: {
    id: string;
    coopname: string;
    order_hash: string;
    membership_fee: string | null;
    status: MarketplaceOrderStatus;
  }, now: Date = new Date()): Promise<MarketplaceSecurePartDTO | null> {
    const row = await this.dueStore.findOne({ order_hash: order.order_hash.toLowerCase() });
    if (row) return this.securePartFromRow(order, row, now);
    const fee = this.fromDecimal(order.membership_fee);
    if (fee <= 0n) return null;
    const zero = this.toDecimal(0n);
    if (ORDER_CLOSED_WITHOUT_ISSUE.has(order.status)) {
      return { state: MarketplaceSecurePartState.RETURNED, amount: this.toDecimal(fee), due_amount: zero, charged_amount: zero, returned_amount: zero, charge_at: null, settled_at: null, rate_percent: null };
    }
    if (order.status === MarketplaceOrderStatuses.RECEIVED) return null;
    return { state: MarketplaceSecurePartState.RESERVED, amount: this.toDecimal(fee), due_amount: zero, charged_amount: zero, returned_amount: zero, charge_at: null, settled_at: null, rate_percent: null };
  }

  private async securePartFromRow(
    order: { id: string; coopname: string },
    row: MarketplaceSecureDueEntity,
    now: Date
  ): Promise<MarketplaceSecurePartDTO> {
    const due = this.fromDecimal(row.due_amount);
    const charged = this.fromDecimal(row.charged_amount);
    const returned = this.fromDecimal(row.returned_amount);
    const base = {
      amount: this.toDecimal(due + charged + returned),
      due_amount: row.due_amount,
      charged_amount: row.charged_amount,
      returned_amount: this.toDecimal(returned),
      rate_percent: null as string | null,
    };
    if (due > 0n && !row.charged_at) {
      const claim = await this.claimRepo.findActiveByOrderId(order.coopname, order.id);
      if (claim) return { ...base, state: MarketplaceSecurePartState.SUSPENDED, charge_at: null, settled_at: null };
      return { ...base, state: MarketplaceSecurePartState.DUE, charge_at: this.chargeDateOf(row, now), settled_at: null };
    }
    const state = charged > 0n ? MarketplaceSecurePartState.CHARGED : MarketplaceSecurePartState.RETURNED;
    const rate_percent = state === MarketplaceSecurePartState.CHARGED ? await this.ratePercentOfRow(order.coopname, row) : null;
    return { ...base, state, charge_at: null, settled_at: row.charged_at, rate_percent };
  }

  /**
   * Когда строка спишется: первое число месяца после гарантийного срока. Срок
   * прошёл, а в список идущего прогона строка не вошла (гарантийный возврат
   * закрыт после расчёта итога) — ближайшее первое число.
   */
  private chargeDateOf(row: MarketplaceSecureDueEntity, now: Date): Date | null {
    if (!row.due_from) return null;
    const timeZone = platformSettings().timezone || 'UTC';
    const byWarranty = standNextPeriodStart(row.due_from, timeZone);
    const waitsNextRun = byWarranty <= now && row.run_period !== monthKey(now, timeZone) - 1;
    return waitsNextRun ? standNextPeriodStart(now, timeZone) : byWarranty;
  }

  /**
   * Ставка, по которой списана строка: у заказа со стоимостью — ставка итога
   * месяца участка (месяц перед списанием), у удержания при отказе — вся сумма
   * участку. Итога в зеркале нет (списано до модели) — ставки нет.
   */
  private async ratePercentOfRow(coopname: string, row: MarketplaceSecureDueEntity): Promise<string | null> {
    if (this.fromDecimal(row.base_amount) <= 0n) return FULL_RATE_PERCENT;
    if (!row.charged_at || !row.braname) return null;
    const period = monthKey(row.charged_at, platformSettings().timezone || 'UTC') - 1;
    const periodRow = await this.periodService.findOne(coopname, row.braname, period);
    return periodRow ? this.periodService.ratePercentOf(periodRow) : null;
  }

  /**
   * Заказы участка, которые созреют к ближайшему первому числу: выданы, не
   * списаны, гарантийный срок кончается до начала следующего месяца. Для строки
   * «текущий месяц, идёт» на экономике участка — без учёта открытых возвратов,
   * они решаются до прогона.
   */
  async ripeningForBranch(coopname: string, braname: string, now: Date): Promise<{ count: number; turnover: bigint; secured: bigint }> {
    const timeZone = platformSettings().timezone || 'UTC';
    // Созреет к первому числу всё, у чего гарантия кончается до конца текущего месяца.
    const nextMonthStart = periodBounds(monthKey(now, timeZone), timeZone).end;
    const totals = await this.runQueries.ripeningTotals(coopname, braname, nextMonthStart);
    return { count: totals.rows, turnover: this.fromDecimal(totals.turnover), secured: this.fromDecimal(totals.secured) };
  }

  // ── Списание первого числа ──────────────────────────────────────────

  /**
   * Раз в час (на стенде со сжатым временем — с шагом стенда): строки,
   * созревшие до начала текущего месяца по часовому поясу кооператива,
   * списываются. Первый прогон месяца — в первый час первого числа; остальные
   * прогоны дописывают то, что не прошло. Крон просыпается каждую минуту, а
   * работает в свой черёд — так шаг стенда меняется без правки расписания.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!isStandWorkerTurn(CHARGE_PACE_SECONDS)) return;
    if (this.running) return;
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    this.running = true;
    try {
      await this.chargeDue(coopname, new Date());
    } catch (err: any) {
      this.logger.warn(`Списание обеспечительной части: прогон упал (${err.message}).`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Проход списания: сверка отправленных строк с кошельками в цепи → список
   * прогона и итог месяца по каждому участку → списание строк списка, не
   * больше предела транзакций за проход. Строки в память целиком не
   * загружаются: отметки ставит одно обновление, суммы итога считает база,
   * читается только страница к списанию.
   */
  async chargeDue(coopname: string, now: Date): Promise<{ charged: number; failed: number }> {
    await this.reconcileSent(coopname);

    const timeZone = platformSettings().timezone || 'UTC';
    const currentMonth = monthKey(now, timeZone);
    // Итог считается за закончившийся месяц: его номер на единицу меньше текущего.
    const period = currentMonth - 1;
    // Строка созрела, если гарантийный срок кончился до начала текущего месяца.
    const monthStart = periodBounds(currentMonth, timeZone).start;

    // Заказ с открытым гарантийным возвратом не списывается: решение совета
    // вернёт обеспечительную часть с кошелька к списанию.
    const blocked = await this.claimRepo.listActiveOrderHashes(coopname);

    const periods = new Map<string, MarketplaceBranchPeriodEntity | null>();
    for (const braname of await this.runQueries.ripeBranches(coopname, monthStart)) {
      periods.set(braname, await this.assignRun(coopname, braname, period, monthStart, blocked));
    }

    const queue = await this.nextToCharge(coopname, period, monthStart, blocked);
    if (queue.length === 0) return { charged: 0, failed: 0 };

    const summary = new ChargedCollector();
    let failed = 0;
    for (const row of queue) {
      const done = await this.chargeQueued(coopname, row, period, periods.get(row.braname) ?? null, summary);
      if (!done) failed++;
    }
    const charged = summary.charged;

    this.logger.info(`Списание обеспечительной части: списано ${charged}, не прошло ${failed} (coopname=${coopname})`);
    await this.notifyCharged(coopname, summary.byUser);
    return { charged, failed };
  }

  /**
   * Списание одной строки страницы: заказ со стоимостью — по ставкам итога
   * месяца участка, удержание при отказе — целиком участку. Возвращает false,
   * если строка не списана (итог участка не рассчитан либо отправка не прошла).
   */
  private async chargeQueued(
    coopname: string,
    row: MarketplaceSecureDueEntity,
    period: number,
    periodRow: MarketplaceBranchPeriodEntity | null,
    summary: ChargedCollector
  ): Promise<boolean> {
    if (!this.hasBase(row)) {
      const units = await this.chargeRow(coopname, row);
      if (units === null) return false;
      summary.note(row, units, 0n, FULL_RATE_PERCENT);
      return true;
    }
    if (!periodRow) return false;
    const result = await this.chargePeriodRow(coopname, row, period);
    if (result === null) return false;
    summary.note(row, result.charged, result.returned, this.periodService.ratePercentOf(periodRow));
    return true;
  }

  /** Заказ со стоимостью идёт по ставкам итога месяца; удержание при отказе стоимости не имеет. */
  private hasBase(row: MarketplaceSecureDueEntity): boolean {
    return this.fromDecimal(row.base_amount) > 0n;
  }

  /**
   * Список прогона участка и итог месяца по нему.
   *
   * Пока итог месяца не рассчитан, все созревшие строки участка получают номер
   * прогона одним обновлением, и итог считается по сумме всех этих строк —
   * сколько бы их ни было. После расчёта список закрыт: строка, которая созрела
   * к списанию позже (гарантийный возврат закрыт в середине месяца), номера не
   * получает и ждёт следующего первого числа — так она входит в расчёт того
   * итога, по ставкам которого списывается. Возвращает строку итога; null —
   * итог не рассчитан, строки участка ждут следующего прохода.
   */
  private async assignRun(
    coopname: string,
    braname: string,
    period: number,
    monthStart: Date,
    blocked: string[]
  ): Promise<MarketplaceBranchPeriodEntity | null> {
    if (!braname) {
      this.logger.error('Списание обеспечительной части: у заказов, созревших к списанию, не известен участок выдачи — итог месяца по ним не считается.');
      return null;
    }
    try {
      // Итог уже рассчитан прежним проходом (в том числе тем, что не успел записать
      // зеркало): список закрыт, новые строки в него не добавляются.
      const marked = await this.runQueries.runTotals(coopname, braname, period);
      const closed = await this.periodService.adoptClosed(coopname, braname, period, marked.rows);
      if (closed) return closed;

      await this.dueStore.update(
        {
          coopname,
          braname,
          charged_at: isNull(),
          charge_sent_at: isNull(),
          due_from: lessThan(monthStart),
          base_amount: moreThan('0'),
          due_amount: moreThan('0'),
        },
        { run_period: period }
      );
      // Заказ с открытым гарантийным возвратом в список не входит.
      if (blocked.length > 0) {
        await this.dueStore.update({ coopname, braname, run_period: period, charged_at: isNull(), order_hash: oneOf(blocked) }, { run_period: null });
      }

      const run = await this.runQueries.runTotals(coopname, braname, period);
      if (run.rows === 0) return null;
      await this.periodService.pruneOld(coopname, braname, period);
      return await this.periodService.ensureClosed(coopname, braname, period, this.fromDecimal(run.turnover), this.fromDecimal(run.secured), run.rows);
    } catch (err: any) {
      this.logger.error(`Итог месяца ${period} участка ${braname} не рассчитан: ${err.message}`);
      return null;
    }
  }

  /**
   * Страница строк к списанию: строки списка этого прогона и удержания при
   * отказе (стоимости нет, в расчёт итога они не входят), созревшие до начала
   * месяца и не отправленные в цепь. Строка без номера прогона ждёт следующего
   * первого числа. Не больше предела транзакций за проход — остальное берёт
   * следующий проход.
   */
  private async nextToCharge(coopname: string, period: number, monthStart: Date, blocked: string[]): Promise<MarketplaceSecureDueEntity[]> {
    const ripe = { coopname, charged_at: isNull(), charge_sent_at: isNull(), due_from: lessThan(monthStart), due_amount: moreThan('0') };
    const rows = await this.dueStore.find(
      [
        { ...ripe, run_period: period },
        { ...ripe, base_amount: lessOrEqual('0') },
      ],
      // Запас на строки с открытым гарантийным возвратом: они отсеиваются после чтения.
      { order: { due_from: 'ASC' }, limit: CHARGE_BATCH_LIMIT + blocked.length }
    );
    const skip = new Set(blocked);
    return rows.filter((row) => !skip.has(row.order_hash)).slice(0, CHARGE_BATCH_LIMIT);
  }

  /**
   * Сверка отправленных строк с кошельками в цепи. Строку закрывает слушатель
   * операций; отметка отправки осталась, а строка не закрыта — значит, либо
   * транзакция не прошла (узел цепи не ответил), либо операции не дошли до
   * учёта. Различает их остаток кошелька пайщика: если в цепи лежит не меньше,
   * чем числится в учёте, списания не было — отметка снимается, строка идёт в
   * этот же проход. Если меньше — деньги списаны, а учёт отстал: строка
   * остаётся с отметкой и повторно не списывается, в журнал пишется тревога.
   */
  private async reconcileSent(coopname: string): Promise<void> {
    const sent = await this.dueStore.find({ coopname, charged_at: isNull(), charge_sent_at: notNull() });
    if (sent.length === 0) return;

    for (const username of new Set(sent.map((row) => row.username))) {
      const mine = sent.filter((row) => row.username === username);
      let onChain: bigint;
      try {
        const wallet = await this.chainPort.getUserWallet(coopname, MARKETPLACE_DUE_WALLET, username);
        onChain = this.economyService.assetToUnits(String(wallet?.available ?? '0'));
      } catch (err: any) {
        this.logger.warn(`Списание обеспечительной части: кошелёк пайщика ${username} в цепи не прочитан (${err.message}) — ${mine.length} отправленных строк ждут сверки.`);
        continue;
      }
      const open = await this.dueStore.find({ coopname, username, charged_at: isNull() });
      const inLedger = open.reduce((sum, row) => sum + this.fromDecimal(row.due_amount), 0n);
      if (onChain >= inLedger) {
        for (const row of mine) await this.dueStore.update({ order_hash: row.order_hash }, { charge_sent_at: null });
        this.logger.warn(`Списание обеспечительной части: у пайщика ${username} ${mine.length} отправленных списаний в цепи не прошли — строки возвращены в прогон.`);
      } else {
        this.logger.error(
          `Списание обеспечительной части: учёт пайщика ${username} разошёлся с кошельком в цепи (в учёте ${this.toDecimal(inLedger)}, в цепи ${this.toDecimal(onChain)}) — отправленные строки ${mine.map((row) => row.order_hash).join(', ')} повторно не списываются и ждут разбора.`
        );
      }
    }
  }

  /**
   * Отправка списания строки. Отметка отправки ставится до транзакции: если
   * узел упадёт или операции не дойдут до учёта, следующий проход строку не
   * возьмёт и заказ не спишется второй раз. Отказ контракта означает, что
   * списание точно не прошло, — отметка снимается сразу. При любом другом сбое
   * исход неизвестен, отметку снимает только сверка с кошельком в цепи.
   */
  private async sendCharge(row: MarketplaceSecureDueEntity, label: string, send: () => Promise<unknown>): Promise<boolean> {
    await this.dueStore.update({ order_hash: row.order_hash }, { charge_sent_at: new Date() });
    try {
      await send();
      return true;
    } catch (err: any) {
      const code = chainErrorCode(err);
      if (!code) {
        this.logger.warn(`${label} по заказу ${row.order_hash}: исход отправки неизвестен (${err.message}) — строка ждёт сверки с кошельком в цепи.`);
        return false;
      }
      await this.dueStore.update({ order_hash: row.order_hash }, { charge_sent_at: null });
      // Превышение остатка — расхождение учёта узла с цепью, остальное — отказ по условиям контракта.
      if (code === DUE_EXCEEDS) {
        this.logger.error(`${label} по заказу ${row.order_hash}: учёт разошёлся с кошельком (${err.message})`);
      } else {
        this.logger.warn(`${label} по заказу ${row.order_hash} не прошло: ${err.message}`);
      }
      return false;
    }
  }

  /** Одна строка — одна транзакция `chargedue`. Возвращает списанное либо null при отказе. */
  private async chargeRow(coopname: string, row: MarketplaceSecureDueEntity): Promise<bigint | null> {
    if (!row.braname) {
      this.logger.error(`Списание обеспечительной части: у заказа ${row.order_hash} не известен участок выдачи.`);
      return null;
    }
    const units = this.fromDecimal(row.due_amount);
    const sent = await this.sendCharge(row, LOG_CHARGE_DUE, () =>
      this.chainPort.chargeDue({
        coopname,
        username: row.username,
        braname: row.braname,
        order_hash: row.order_hash,
        amount: this.economyService.unitsToAsset(units),
      })
    );
    return sent ? units : null;
  }

  /**
   * Одна строка прогона — одна транзакция `chargeperiod` (задача 99D-22):
   * контракт делит остаток по ставкам итога месяца. Транзакция возвращается
   * после разбора блока, поэтому строка учёта уже обновлена слушателем:
   * списанное и возвращённое читаются из неё, а не считаются здесь.
   */
  private async chargePeriodRow(
    coopname: string,
    row: MarketplaceSecureDueEntity,
    period: number
  ): Promise<{ charged: bigint; returned: bigint } | null> {
    const amount = this.fromDecimal(row.due_amount);
    const sent = await this.sendCharge(row, LOG_CHARGE_PERIOD, () =>
      this.chainPort.chargePeriod({
        coopname,
        username: row.username,
        braname: row.braname,
        order_hash: row.order_hash,
        amount: this.economyService.unitsToAsset(amount),
        base: this.economyService.unitsToAsset(this.fromDecimal(row.base_amount)),
        period,
      })
    );
    if (!sent) return null;
    await this.periodService.noteCharged(coopname, row.braname, period, 1);
    const after = await this.dueStore.findOne({ order_hash: row.order_hash });
    if (!after || this.fromDecimal(after.due_amount) === amount) {
      // Слушатель ещё не донёс операции — письмо получит сумму списания без деления.
      this.logger.warn(`Списание по итогу месяца по заказу ${row.order_hash}: учёт не успел обновиться к письму.`);
      return { charged: amount, returned: 0n };
    }
    return {
      charged: this.fromDecimal(after.charged_amount) - this.fromDecimal(row.charged_amount),
      returned: this.fromDecimal(after.returned_amount) - this.fromDecimal(row.returned_amount),
    };
  }

  /** Письмо пайщику — одно за прогон и только если по нему что-то списано. */
  private async notifyCharged(coopname: string, chargedByUser: Map<string, ChargedSummary>): Promise<void> {
    for (const [username, { units, returned, orders, rate }] of chargedByUser) {
      if (units <= 0n && returned <= 0n) continue;
      try {
        const payload: Workflows.MarketplaceSecurePartCharged.IPayload = {
          userName: await this.accountPort.getDisplayName(username),
          // Пайщик читает сумму в два знака, как во всех уведомлениях; цепь хранит четыре.
          amount: AmountFormatterUtils.formatAmountSafe(this.economyService.unitsToAsset(units)),
          ordersCount: String(orders),
          returnedAmount: AmountFormatterUtils.formatAmountSafe(this.economyService.unitsToAsset(returned)),
          ratePercent: rate,
          coopname,
          deepLinkUrl: `${platformSettings().frontendUrl}/${coopname}/market/my-orders`,
        };
        await this.notifications.notifyUser(username, Workflows.MarketplaceSecurePartCharged.id, payload);
      } catch (err: any) {
        this.logger.warn(`Списание обеспечительной части: письмо пайщику ${username} не отправлено (${err.message}).`);
      }
    }
  }

  private toDecimal(units: bigint): string {
    return this.economyService.unitsToAsset(units).split(' ')[0] ?? '0';
  }

  private fromDecimal(value: string | null | undefined): bigint {
    return this.economyService.assetToUnits(String(value ?? '0'));
  }
}
