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
import { AmountFormatterUtils, TableStore, chainErrorCode, isNull, lessOrEqual, platformSettings, standNextPeriodStart, standPeriodKey, isStandWorkerTurn } from '@coopenomics/extension-kit';
import { MARKETPLACE_SECURE_DUE_STORE } from '../../infrastructure/database/marketplace-stores';
import { MarketplaceSecureDueEntity } from '../../infrastructure/entities/marketplace-secure-due.entity';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_RETURN_CLAIM_REPOSITORY,
  type MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import { MARKETPLACE_RETURN_CLAIM_ACTIVE_STATUSES } from '../../domain/entities/marketplace-return-claim.types';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import { MarketplacePeriodService } from './marketplace-period.service';
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

/** Сколько строк крон списывает за прогон — защита от лавины транзакций. */
const CHARGE_BATCH_LIMIT = 200;

/** Сколько открытых заявлений на возврат читается за прогон — их у кооператива единицы. */
const OPEN_CLAIMS_LIMIT = 1000;

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
    private readonly periodService: MarketplacePeriodService
  ) {
    this.logger.setContext(MarketplaceSecureDueService.name);
  }

  // ── Учёт по операциям контракта ──────────────────────────────────────

  @OnEvent(`action::${Ledger2Contract.contractName.production}::${Ledger2Contract.Actions.Apply.actionName}`)
  async onLedgerApply(action: InnerChainActionRecord): Promise<void> {
    try {
      await this.applyOperation(action);
    } catch (err: any) {
      this.logger.error(`Учёт обеспечительной части: операция ${action.global_sequence} не учтена (${err.message})`, err.stack);
    }
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
  }): Promise<MarketplaceSecurePartDTO | null> {
    const row = await this.dueStore.findOne({ order_hash: order.order_hash.toLowerCase() });
    if (row) return this.securePartFromRow(order, row);
    const fee = this.fromDecimal(order.membership_fee);
    if (fee <= 0n) return null;
    const zero = this.toDecimal(0n);
    if (ORDER_CLOSED_WITHOUT_ISSUE.has(order.status)) {
      return { state: MarketplaceSecurePartState.RETURNED, amount: this.toDecimal(fee), due_amount: zero, charged_amount: zero, returned_amount: zero, charge_at: null, settled_at: null };
    }
    if (order.status === MarketplaceOrderStatuses.RECEIVED) return null;
    return { state: MarketplaceSecurePartState.RESERVED, amount: this.toDecimal(fee), due_amount: zero, charged_amount: zero, returned_amount: zero, charge_at: null, settled_at: null };
  }

  private async securePartFromRow(
    order: { id: string; coopname: string },
    row: MarketplaceSecureDueEntity
  ): Promise<MarketplaceSecurePartDTO> {
    const due = this.fromDecimal(row.due_amount);
    const charged = this.fromDecimal(row.charged_amount);
    const returned = this.fromDecimal(row.returned_amount);
    const base = {
      amount: this.toDecimal(due + charged + returned),
      due_amount: row.due_amount,
      charged_amount: row.charged_amount,
      returned_amount: this.toDecimal(returned),
    };
    if (due > 0n && !row.charged_at) {
      const claim = await this.claimRepo.findActiveByOrderId(order.coopname, order.id);
      if (claim) return { ...base, state: MarketplaceSecurePartState.SUSPENDED, charge_at: null, settled_at: null };
      const timeZone = platformSettings().timezone || 'UTC';
      const charge_at = row.due_from ? standNextPeriodStart(row.due_from, timeZone) : null;
      return { ...base, state: MarketplaceSecurePartState.DUE, charge_at, settled_at: null };
    }
    const state = charged > 0n ? MarketplaceSecurePartState.CHARGED : MarketplaceSecurePartState.RETURNED;
    return { ...base, state, charge_at: null, settled_at: row.charged_at };
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

  async chargeDue(coopname: string, now: Date): Promise<{ charged: number; failed: number }> {
    const ripe = await this.ripeRows(coopname, now);
    if (ripe.length === 0) return { charged: 0, failed: 0 };

    // Заказ с открытым гарантийным возвратом не списывается: решение совета
    // вернёт обеспечительную часть с кошелька к списанию.
    const openClaims = await this.claimRepo.listByStatus(coopname, [...MARKETPLACE_RETURN_CLAIM_ACTIVE_STATUSES], OPEN_CLAIMS_LIMIT);
    const blocked = new Set(openClaims.map((c) => c.order_hash.toLowerCase()));

    const rows = ripe.filter((r) => !blocked.has(r.order_hash));
    // Итог считается за закончившийся месяц: его номер на единицу меньше текущего.
    const period = monthKey(now, platformSettings().timezone || 'UTC') - 1;

    const summary = new ChargedCollector();
    // Итог месяца считается на участок: строки прогона группируются по участку выдачи.
    const byBranch = new Map<string, MarketplaceSecureDueEntity[]>();
    for (const row of rows) {
      const list = byBranch.get(row.braname) ?? [];
      list.push(row);
      byBranch.set(row.braname, list);
    }
    let failed = 0;
    for (const [braname, branchRows] of byBranch) {
      failed += await this.chargeBranch(coopname, braname, branchRows, period, summary);
    }
    const charged = summary.charged;
    const chargedByUser = summary.byUser;

    this.logger.info(`Списание обеспечительной части: списано ${charged}, не прошло ${failed} (coopname=${coopname})`);
    await this.notifyCharged(coopname, chargedByUser);
    return { charged, failed };
  }

  /**
   * Прогон одного участка. Заказы со стоимостью идут по ставкам итога месяца;
   * удержания при отказе (стоимости нет) — целиком участку, как и прежде.
   * Возвращает число строк, которые не прошли.
   */
  private async chargeBranch(
    coopname: string,
    braname: string,
    branchRows: MarketplaceSecureDueEntity[],
    period: number,
    summary: ChargedCollector
  ): Promise<number> {
    const withBase = branchRows.filter((r) => this.fromDecimal(r.base_amount) > 0n);
    const withoutBase = branchRows.filter((r) => this.fromDecimal(r.base_amount) <= 0n);
    let failed = 0;

    const periodRow = withBase.length > 0 && braname ? await this.closeBranchPeriod(coopname, braname, withBase, period) : null;
    for (const row of withBase) {
      const result = periodRow ? await this.chargePeriodRow(coopname, row, period) : null;
      if (result === null || !periodRow) {
        failed++;
        continue;
      }
      summary.note(row, result.charged, result.returned, this.periodService.ratePercentOf(periodRow));
    }
    for (const row of withoutBase) {
      const units = await this.chargeRow(coopname, row);
      if (units === null) {
        failed++;
        continue;
      }
      summary.note(row, units, 0n, FULL_RATE_PERCENT);
    }
    return failed;
  }

  /** Итог месяца участка по строкам прогона со стоимостью; при отказе цепи — null и запись в журнал. */
  private async closeBranchPeriod(
    coopname: string,
    braname: string,
    withBase: MarketplaceSecureDueEntity[],
    period: number
  ): Promise<MarketplaceBranchPeriodEntity | null> {
    try {
      await this.periodService.pruneOld(coopname, braname, period);
      const turnover = withBase.reduce((s, r) => s + this.fromDecimal(r.base_amount), 0n);
      const secured = withBase.reduce((s, r) => s + this.fromDecimal(r.due_amount), 0n);
      return await this.periodService.ensureClosed(coopname, braname, period, turnover, secured, withBase.length);
    } catch (err: any) {
      this.logger.error(`Итог месяца ${period} участка ${braname} не рассчитан: ${err.message}`);
      return null;
    }
  }

  /** Строки, созревшие до начала текущего месяца по часовому поясу кооператива. */
  private async ripeRows(coopname: string, now: Date): Promise<MarketplaceSecureDueEntity[]> {
    const timeZone = platformSettings().timezone || 'UTC';
    const currentMonth = monthKey(now, timeZone);
    const candidates = await this.dueStore.find(
      { coopname, charged_at: isNull(), due_from: lessOrEqual(now) },
      { order: { due_from: 'ASC' }, limit: CHARGE_BATCH_LIMIT }
    );
    return candidates.filter(
      (row) => row.due_from && monthKey(row.due_from, timeZone) < currentMonth && this.fromDecimal(row.due_amount) > 0n
    );
  }

  /** Одна строка — одна транзакция `chargedue`. Возвращает списанное либо null при отказе. */
  private async chargeRow(coopname: string, row: MarketplaceSecureDueEntity): Promise<bigint | null> {
    if (!row.braname) {
      this.logger.error(`Списание обеспечительной части: у заказа ${row.order_hash} не известен участок выдачи.`);
      return null;
    }
    const units = this.fromDecimal(row.due_amount);
    try {
      await this.chainPort.chargeDue({
        coopname,
        username: row.username,
        braname: row.braname,
        order_hash: row.order_hash,
        amount: this.economyService.unitsToAsset(units),
      });
      return units;
    } catch (err: any) {
      // Превышение остатка — расхождение учёта узла с цепью, остальное — сбой отправки.
      if (chainErrorCode(err) === DUE_EXCEEDS) {
        this.logger.error(`Списание обеспечительной части по заказу ${row.order_hash}: учёт разошёлся с кошельком (${err.message})`);
      } else {
        this.logger.warn(`Списание обеспечительной части по заказу ${row.order_hash} не прошло: ${err.message}`);
      }
      return null;
    }
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
    try {
      await this.chainPort.chargePeriod({
        coopname,
        username: row.username,
        braname: row.braname,
        order_hash: row.order_hash,
        amount: this.economyService.unitsToAsset(amount),
        base: this.economyService.unitsToAsset(this.fromDecimal(row.base_amount)),
        period,
      });
    } catch (err: any) {
      if (chainErrorCode(err) === DUE_EXCEEDS) {
        this.logger.error(`Списание по итогу месяца по заказу ${row.order_hash}: учёт разошёлся с кошельком (${err.message})`);
      } else {
        this.logger.warn(`Списание по итогу месяца по заказу ${row.order_hash} не прошло: ${err.message}`);
      }
      return null;
    }
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
