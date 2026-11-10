import { createHash } from 'crypto';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BranchContract, Ledger2Contract, MarketContract } from 'cooptypes';
import { Workflows } from '@coopenomics/notifications';
import {
  ACCOUNT_PORT,
  LEDGER2_HISTORY_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  type IAccountPort,
  type ILedger2HistoryPort,
  type ILoggerPort,
  type INotificationPort,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
import { AmountFormatterUtils, TableStore, chainErrorCode, isNull, moreOrEqual, moreThan, platformSettings, standNextPeriodStart, standPeriodKey, isStandWorkerTurn } from '@coopenomics/extension-kit';
import { MARKETPLACE_SECURE_DUE_STORE } from '../../infrastructure/database/marketplace-stores';
import { MARKETPLACE_INVEST_REPAID_EVENT, type MarketplaceInvestRepaidEvent } from '../events/marketplace-notification.events';
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
import { aidPeriodKey } from './marketplace-branch-reserve.service';
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
  /** Списание в членский взнос по итогу периода — нитка строки счётчика пайщика (p.mkt.due). */
  CHARGE = 'o.mkt.charge',
  /** Выход пайщика: остаток списывается немедленно. */
  EXIT = 'o.mkt.exfee',
  /** Факт выдачи — стоимость заказа, основание деления списания по ставкам итога (задача 99D-22). */
  CONSUM = 'o.mkt.consum',
  /** Возврат части обеспечительной части пайщику по итогу периода — нитка строки счётчика (p.mkt.due). */
  RETURN_DUE = 'o.mkt.retdue',
}

/** Сводка списаний одного пайщика за прогон — для письма. */
interface ChargedSummary {
  /** Списано в членский взнос: участку, в фонды и инициатору вместе. */
  units: bigint;
  /** Возвращено пайщику на свободный паевой. */
  returned: bigint;
  orders: number;
  /** Коэффициент экономического участия за период, проценты с двумя знаками. */
  rate: string;
}

/** Накопитель списанного по пайщикам за прогон: одно письмо на пайщика. */
class ChargedCollector {
  charged = 0;
  readonly byUser = new Map<string, ChargedSummary>();
  /** Участки, где доля инициаторов в этом проходе возместила паевые взносы. */
  readonly repaidBranches = new Set<string>();

  note(username: string, units: bigint, returned: bigint, orders: number, rate: string): void {
    this.charged++;
    const acc = this.byUser.get(username) ?? { units: 0n, returned: 0n, orders: 0, rate };
    this.byUser.set(username, { units: acc.units + units, returned: acc.returned + returned, orders: acc.orders + orders, rate: acc.rate });
  }
}

/** Коэффициент экономического участия удержаний без стоимости: вся сумма участку. */
const FULL_RATE_PERCENT = '100.00';

/** Шаг крона списания в работе — час. */
const CHARGE_PACE_SECONDS = 60 * 60;

/**
 * Сколько транзакций списания крон отправляет за проход — защита от лавины
 * транзакций. Остальные строки списывает следующий проход.
 */
const CHARGE_BATCH_LIMIT = 200;

/** Отказы контракта на списание строки, которые для прогона — норма, а не сбой. */
const DUE_RETURN_PENDING = 'MARKETPLACE_DUE_RETURN_PENDING';
const PERIOD_NOT_CLOSED = 'MARKETPLACE_PERIOD_NOT_CLOSED';
const PERIOD_EMPTY = 'MARKETPLACE_PERIOD_EMPTY';
/** На сколько месяцев назад участок догоняет итоги месяцев без выданных заказов. */
const QUIET_CATCHUP_LIMIT = 12;

/** Месяц участка, которому нужен итог: строк счётчиков пайщиков и признак месяца без счётчика участка. */
interface MonthToClose {
  rows: number;
  quiet: boolean;
}
/** Отказ контракта, когда учтено больше, чем лежит на кошельке, — расхождение, требующее разбора. */
const DUE_EXCEEDS = 'MARKETPLACE_DUE_EXCEEDS';

/** Операция ledger2, разобранная из события цепи. */
interface AppliedOperation {
  coopname: string;
  username: string;
  /** Хэш процесса в нижнем регистре: заказа, заявления о возврате либо строки счётчика. */
  hash: string;
  units: bigint;
  blockTime: Date;
  sequence: string;
}

/** Строка счётчика пайщика из цепи с числами в единицах актива. */
interface DueRow {
  username: string;
  braname: string;
  period: number;
  turnover: bigint;
  due: bigint;
  retained: bigint;
  orders: number;
}

/** Более поздний из двух моментов; пустой не участвует. */
function laterOf(a: Date | null | undefined, b: Date): Date {
  return a && a > b ? a : b;
}

/**
 * Номер расчётного месяца узла: в работе — календарный месяц в часовом поясе
 * кооператива (год × 12 + месяц), на стенде со сжатым временем — отрезок
 * длиной `STAND_MONTH_SECONDS`. Для границ периода в экранах; периоды
 * списания нумерует контракт (`aidPeriodKey`).
 */
export function monthKey(date: Date, timeZone: string): number {
  return standPeriodKey(date, timeZone);
}

/**
 * Хэш нитки списания строки счётчика — тот же, что считает контракт
 * (`Marketplace::Dues::charge_hash`): sha256 строки-основания из `PeriodModel`.
 */
export function chargeHashOf(coopname: string, username: string, braname: string, period: number): string {
  return createHash('sha256').update(MarketContract.PeriodModel.chargeProcessSeed(coopname, username, braname, period)).digest('hex');
}

/**
 * Обеспечительная часть паевого взноса к списанию (задачи 99D-18, 99D-33).
 *
 * При заказе пайщик сверх стоимости имущества вносит обеспечительную часть —
 * паевой взнос по ставке кооператива. На выдаче её факт ложится на кошелёк
 * пайщика к списанию `w.mkt.due`; на этот же кошелёк ложится удержание при
 * отказе от получения. Членским взносом участка она становится при списании
 * по условиям ЦПП, без подписи пайщика: по окончании периода, в котором
 * кончился гарантийный срок заказа. Пока гарантия идёт, гарантийный возврат
 * возвращает её на свободный паевой без обратных проводок.
 *
 * Сколько и за какой период списывать, знает контракт: счётчики `kudues`
 * (пайщик, участок, период) и `kucounters` (участок, период) он пишет теми же
 * транзакциями, что двигают кошелёк. Узел первого числа только называет
 * контракту участок и период для итога (`closeperiod`, с фактами о расходах) и
 * пайщика, участок и период для списания строки (`chargeperiod`); суммы в
 * цепь он не передаёт.
 *
 * Зеркало `marketplace_secure_due` (строка на заказ) остаётся для показа
 * пайщику: что по заказу ждёт списания, что списано и возвращено. Его
 * заполняет слушатель операций ledger2 из того, что провёл контракт; на
 * списание оно не влияет. Списание строки счётчика закрывает все заказы
 * пайщика того же участка и периода разом — узел узнаёт их по хэшу нитки.
 */
@Injectable()
export class MarketplaceSecureDueService implements OnApplicationBootstrap {
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
    @Inject(LEDGER2_HISTORY_PORT) private readonly ledger2History: ILedger2HistoryPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly periodService: MarketplacePeriodService,
    private readonly eventBus: EventEmitter2
  ) {
    this.logger.setContext(MarketplaceSecureDueService.name);
  }

  // ── Периоды списания ────────────────────────────────────────────────

  /** Настройки участков из цепи: длина периода списания (она же — периода предела помощи). */
  private branchConfig(coopname: string): Promise<BranchContract.Tables.BranchConfig.IBranchConfig | null> {
    return this.chainPort.getBranchConfig(coopname);
  }

  /** Период списания для момента — так же, как контракт (`Marketplace::Dues::period_of`). */
  private periodOf(config: BranchContract.Tables.BranchConfig.IBranchConfig | null, at: Date): number {
    return aidPeriodKey(config, at);
  }

  /** Период строки зеркала: конец гарантийного срока, у удержания — момент удержания. */
  private rowPeriod(config: BranchContract.Tables.BranchConfig.IBranchConfig | null, row: MarketplaceSecureDueEntity): number {
    return this.periodOf(config, row.due_from ?? row.created_at);
  }

  // ── Переходный перенос (задача 99D-33, п. 6) ────────────────────────

  /**
   * Первый старт после обновления: строки зеркала, выданные до появления
   * счётчиков, переносятся в цепь действием `migratedue` — иначе их
   * обеспечительная часть не списалась бы никогда. Признак переноса — в цепи
   * нет ни одной строки счётчика пайщика. Старт узла перенос не держит.
   */
  onApplicationBootstrap(): void {
    void this.migrateMirror().catch((err: any) => {
      this.logger.error(`Перенос учёта обеспечительной части в счётчики цепи не выполнен (${err.message})`, err.stack);
    });
  }

  async migrateMirror(): Promise<{ moved: number; failed: number }> {
    const coopname = platformSettings().coopname;
    if (!coopname) return { moved: 0, failed: 0 };
    if (await this.chainPort.hasAnyDues(coopname)) return { moved: 0, failed: 0 };

    const open = await this.dueStore.find(
      { coopname, charged_at: isNull(), due_amount: moreThan('0') },
      { order: { due_from: 'ASC' } }
    );
    if (open.length === 0) return { moved: 0, failed: 0 };

    const config = await this.branchConfig(coopname);
    let moved = 0;
    let failed = 0;
    for (const row of open) {
      if (!row.braname) {
        this.logger.error(`Перенос учёта обеспечительной части: у заказа ${row.order_hash} не известен участок — строка не перенесена.`);
        failed++;
        continue;
      }
      const base = this.fromDecimal(row.base_amount);
      const due = this.fromDecimal(row.due_amount);
      // Строка, уже вошедшая в рассчитанный итог, остаётся в его периоде —
      // списание идёт по его ставкам; остальные — по концу гарантийного срока.
      const period = row.run_period ?? this.rowPeriod(config, row);
      try {
        await this.chainPort.migrateDue({
          coopname,
          username: row.username,
          braname: row.braname,
          period,
          turnover: this.economyService.unitsToAsset(base),
          due: this.economyService.unitsToAsset(base > 0n ? due : 0n),
          retained: this.economyService.unitsToAsset(base > 0n ? 0n : due),
        });
        moved++;
      } catch (err: any) {
        this.logger.error(`Перенос учёта обеспечительной части: заказ ${row.order_hash} не перенесён (${err.message})`);
        failed++;
      }
    }
    this.logger.info(`Перенос учёта обеспечительной части в счётчики цепи: перенесено ${moved}, не перенесено ${failed} (coopname=${coopname})`);
    return { moved, failed };
  }

  // ── Зеркало по операциям контракта ──────────────────────────────────

  /**
   * Операции учёта идут строго по очереди, в порядке цепи. Шина выпускает
   * действия одного блока разом и слушателей не ждёт, а одна транзакция несёт
   * по заказу сразу две операции: выдача — стоимость и постановку к списанию,
   * списание строки счётчика — списанную и возвращённую части. Обе читают и
   * пишут одни строки; без очереди вторая вставка падала по ключу, а второе
   * обновление затирало первое (журнал полигона 04.11.2026).
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
  private readonly handlers: Record<MarketplaceSecureDueOperation, (_op: AppliedOperation) => Promise<void>> = {
    [MarketplaceSecureDueOperation.TO_DUE]: (op) => this.accrue(op),
    [MarketplaceSecureDueOperation.PENALTY]: (op) => this.accrue(op),
    [MarketplaceSecureDueOperation.CHARGE]: (op) => this.settleGroup(op, 'charged'),
    [MarketplaceSecureDueOperation.UNDUE]: (op) => this.reduceByClaim(op),
    [MarketplaceSecureDueOperation.EXIT]: (op) => this.settleOnExit(op),
    [MarketplaceSecureDueOperation.CONSUM]: (op) => this.setBase(op),
    [MarketplaceSecureDueOperation.RETURN_DUE]: (op) => this.settleGroup(op, 'returned'),
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
   * основание деления списания по ставкам итога. Выдача и постановка к
   * списанию идут одной транзакцией в любом порядке: строка заводится тем,
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
    const order_hash = claim.order_hash.toLowerCase();
    const row = await this.dueStore.findOne({ order_hash });
    if (!row) {
      this.logger.error(`Учёт обеспечительной части: по заказу ${order_hash} строки нет — возврат на ${this.toDecimal(op.units)} не учтён.`);
      return;
    }
    if (this.alreadyApplied(row, op.sequence)) return;
    const before = this.fromDecimal(row.due_amount);
    if (before < op.units) {
      this.logger.error(`Учёт обеспечительной части: по заказу ${order_hash} возвращено больше учтённого (${this.toDecimal(op.units)} при остатке ${row.due_amount}).`);
    }
    const due = before > op.units ? before - op.units : 0n;
    await this.dueStore.update(
      { order_hash },
      { due_amount: this.toDecimal(due), charged_at: due === 0n ? op.blockTime : null, last_sequence: op.sequence }
    );
  }

  /**
   * Списание строки счётчика (нитка p.mkt.due): одна операция закрывает все
   * заказы пайщика того же участка и периода. Заказы узнаются по хэшу нитки —
   * он считается из участка и периода созревания каждой строки зеркала так же,
   * как в контракте. Сумма операции раскладывается по заказам пропорционально
   * их обеспечительной части, остаток округления — последнему: по заказу это
   * показ, факт списания — вся строка счётчика. Вторая операция той же
   * транзакции (возврат пайщику) находит уже закрытые строки по моменту блока.
   */
  private async settleGroup(op: AppliedOperation, kind: 'charged' | 'returned'): Promise<void> {
    const config = await this.branchConfig(op.coopname);
    const candidates = [
      ...(await this.dueStore.find({ coopname: op.coopname, username: op.username, charged_at: isNull() })),
      ...(await this.dueStore.find({ coopname: op.coopname, username: op.username, charged_at: moreOrEqual(op.blockTime) })),
    ];
    const group = candidates.filter(
      (row) => !this.alreadyApplied(row, op.sequence) && chargeHashOf(op.coopname, op.username, row.braname, this.rowPeriod(config, row)) === op.hash
    );
    if (group.length === 0) {
      this.logger.error(`Учёт обеспечительной части: списание ${op.hash} пайщика ${op.username} на ${this.toDecimal(op.units)} не нашло заказов в зеркале.`);
      return;
    }
    const weights = group.map((row) => this.fromDecimal(row.due_amount) + this.fromDecimal(row.charged_amount) + this.fromDecimal(row.returned_amount));
    const total = weights.reduce((sum, w) => sum + w, 0n);
    let distributed = 0n;
    for (let i = 0; i < group.length; i++) {
      const row = group[i];
      const share = i === group.length - 1 ? op.units - distributed : total > 0n ? (op.units * weights[i]) / total : 0n;
      distributed += share;
      await this.dueStore.update(
        { order_hash: row.order_hash },
        {
          due_amount: this.toDecimal(0n),
          charged_amount: kind === 'charged' ? this.toDecimal(this.fromDecimal(row.charged_amount) + share) : row.charged_amount,
          returned_amount: kind === 'returned' ? this.toDecimal(this.fromDecimal(row.returned_amount) + share) : row.returned_amount,
          charged_at: row.charged_at ?? op.blockTime,
          last_sequence: op.sequence,
        }
      );
    }
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
   * Сколько, в каком состоянии и когда спишется — по строке зеркала.
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
   * Когда строка спишется: начало периода, следующего за концом гарантийного
   * срока. Срок прошёл, а строка ещё не списана (ждёт решения совета по
   * возврату либо своего прохода) — ближайшее начало периода.
   */
  private chargeDateOf(row: MarketplaceSecureDueEntity, now: Date): Date | null {
    if (!row.due_from) return null;
    const timeZone = platformSettings().timezone || 'UTC';
    const byWarranty = standNextPeriodStart(row.due_from, timeZone);
    return byWarranty <= now ? standNextPeriodStart(now, timeZone) : byWarranty;
  }

  /**
   * Ставка, по которой списана строка: у заказа со стоимостью — ставка итога
   * участка за период созревания, у удержания при отказе — вся сумма участку.
   * Итога в зеркале нет (списано до модели) — ставки нет.
   */
  private async ratePercentOfRow(coopname: string, row: MarketplaceSecureDueEntity): Promise<string | null> {
    if (this.fromDecimal(row.base_amount) <= 0n) return FULL_RATE_PERCENT;
    if (!row.braname) return null;
    const period = this.rowPeriod(await this.branchConfig(coopname), row);
    const periodRow = await this.periodService.findOne(coopname, row.braname, period);
    return periodRow ? this.periodService.ratePercentOf(periodRow) : null;
  }

  /**
   * Заказы участка, которые созреют к ближайшему началу периода, — из
   * счётчиков участка в цепи: открытые счётчики с периодом не позже текущего.
   * Для строки «текущий период, идёт» на экономике участка.
   */
  async ripeningForBranch(coopname: string, braname: string, now: Date): Promise<{ count: number; turnover: bigint; secured: bigint }> {
    const current = this.periodOf(await this.branchConfig(coopname), now);
    const counters = (await this.chainPort.listDueCounters(coopname)).filter((c) => String(c.braname) === braname && Number(c.period) <= current);
    return counters.reduce(
      (acc, c) => ({
        count: acc.count + Number(c.orders ?? 0),
        turnover: acc.turnover + this.economyService.assetToUnits(String(c.turnover ?? '0')),
        secured: acc.secured + this.economyService.assetToUnits(String(c.secured ?? '0')),
      }),
      { count: 0, turnover: 0n, secured: 0n }
    );
  }

  // ── Списание по окончании периода ────────────────────────────────────

  /**
   * Раз в час (на стенде со сжатым временем — с шагом стенда) проход по
   * счётчикам цепи: закончившиеся периоды участков получают итог, строки
   * пайщиков закончившихся периодов списываются. Крон просыпается каждую
   * минуту, а работает в свой черёд — так шаг стенда меняется без правки
   * расписания.
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
   * Проход списания: итог по каждому закончившемуся периоду участка (счётчик
   * участка с периодом раньше текущего) → строки счётчиков пайщиков
   * закончившихся периодов, не больше предела транзакций за проход. Суммы в
   * цепь не передаются: контракт берёт их из своих строк.
   */
  async chargeDue(coopname: string, now: Date): Promise<{ charged: number; failed: number }> {
    const current = this.periodOf(await this.branchConfig(coopname), now);
    const counters = (await this.chainPort.listDueCounters(coopname)).filter((c) => Number(c.period) < current);
    const { queue, keepByBranch } = await this.ripeRows(coopname, counters, current);

    await this.closeEndedPeriods(coopname, current, counters, keepByBranch);
    const summary = new ChargedCollector();
    let failed = 0;
    for (const row of queue.slice(0, CHARGE_BATCH_LIMIT)) {
      const done = await this.chargeRow(coopname, row, summary);
      if (!done) failed++;
    }

    this.logger.info(`Списание обеспечительной части: списано строк ${summary.charged}, не прошло ${failed} (coopname=${coopname})`);
    await this.notifyCharged(coopname, summary.byUser);
    if (summary.repaidBranches.size > 0) {
      const event: MarketplaceInvestRepaidEvent = { coopname, branames: [...summary.repaidBranches] };
      this.eventBus.emit(MARKETPLACE_INVEST_REPAID_EVENT, event);
    }
    return { charged: summary.charged, failed };
  }

  /**
   * Итоги закончившихся периодов прохода: по каждому участку от старых месяцев
   * к новым, затем стирание старых итогов.
   *
   * Месяцы участка — периоды его счётчиков и месяцы без выданных заказов между
   * последним итогом участка в цепи и текущим месяцем. Счётчик без стоимости
   * (одни удержания при отказе или всё возвращено по гарантии) тоже получает
   * итог: расчёт стирает счётчик из цепи, иначе он оставался бы в ней навсегда.
   *
   * Порядок итогов участка — строгий: собранная часть цели резерва переходит
   * из итога в итог (задача 99D-34). Итог не рассчитан (сбой цепи) — более
   * поздние месяцы этого участка в проходе не считаются: расчёт следующего
   * месяца взял бы собранную часть цели из позапрошлой строки, и участок
   * собрал бы цель резерва второй раз. Участок ждёт следующего прохода.
   */
  private async closeEndedPeriods(
    coopname: string,
    current: number,
    counters: MarketContract.Tables.Counters.IKuCounter[],
    keepByBranch: Map<string, Set<number>>
  ): Promise<void> {
    const months = await this.monthsToClose(coopname, current, counters);
    for (const braname of [...months.keys()].sort()) {
      const periods = months.get(braname) ?? new Map<number, MonthToClose>();
      let failed = false;
      for (const period of [...periods.keys()].sort((a, b) => a - b)) {
        const month = periods.get(period) as MonthToClose;
        if (await this.ensurePeriod(coopname, braname, period, month.rows, month.quiet)) continue;
        failed = true;
        break;
      }
      // Старые итоги стираются после всех расчётов участка: каждый месяц
      // считается по строке предыдущего, и стирать её между расчётами нельзя.
      // Участок со сбоем не трогаем: следующему проходу нужна прошлая строка.
      if (!failed) await this.periodService.pruneOld(coopname, braname, current, keepByBranch.get(braname) ?? new Set());
    }
  }

  /**
   * Месяцы, которым в этом проходе нужен итог, по участкам. Месяц без выданных
   * заказов (задача 99D-34): счётчика нет, но расходы, цель резерва и право
   * получателей помощи у месяца есть. Участки — со строками итога в цепи, со
   * строками резерва помощи или с записями реестра планов; нечего нести —
   * строки не будет (решает `ensureQuietClosed`).
   *
   * Участок догоняет все пропущенные месяцы — от месяца после его последнего
   * итога в цепи, не глубже `QUIET_CATCHUP_LIMIT`: узел мог простоять дольше
   * месяца, и траты пропущенных месяцев иначе не попали бы в расходы. Участок
   * без итогов в цепи начинает с прошлого месяца.
   */
  private async monthsToClose(
    coopname: string,
    current: number,
    counters: MarketContract.Tables.Counters.IKuCounter[]
  ): Promise<Map<string, Map<number, MonthToClose>>> {
    const months = new Map<string, Map<number, MonthToClose>>();
    const of = (braname: string): Map<number, MonthToClose> => {
      let periods = months.get(braname);
      if (!periods) {
        periods = new Map<number, MonthToClose>();
        months.set(braname, periods);
      }
      return periods;
    };
    for (const counter of counters) of(String(counter.braname)).set(Number(counter.period), { rows: Number(counter.members ?? 0), quiet: false });

    // Участки для месяцев без заказов читаются из реестра планов и цепи. Сбой
    // чтения проход не роняет: месяцы по счётчикам считаются, месяцы без
    // заказов ждут следующего прохода.
    let candidates: string[] = [];
    try {
      candidates = await this.periodService.quietCandidates(coopname);
    } catch (err: any) {
      this.logger.warn(`Участки для итога месяца без заказов не прочитаны: ${err.message}`);
      return months;
    }
    const lastClosed = new Map<string, number>();
    for (const row of await this.chainPort.listAllBranchPeriods(coopname)) {
      const braname = String(row.braname);
      lastClosed.set(braname, Math.max(lastClosed.get(braname) ?? 0, Number(row.period)));
    }
    for (const braname of candidates) {
      const last = lastClosed.get(braname);
      const from = last === undefined ? current - 1 : Math.max(last + 1, current - QUIET_CATCHUP_LIMIT);
      const periods = of(braname);
      for (let period = from; period < current; period++) {
        if (!periods.has(period)) periods.set(period, { rows: 0, quiet: true });
      }
    }
    return months;
  }

  /**
   * Строки пайщиков закончившихся периодов — по участкам прохода: с открытым
   * счётчиком закончившегося периода и с итогом в цепи (у такого итога могут
   * оставаться несписанные строки). Заодно — периоды, у которых строки ещё
   * есть: их итоги стирать нельзя.
   */
  private async ripeRows(
    coopname: string,
    counters: MarketContract.Tables.Counters.IKuCounter[],
    current: number
  ): Promise<{ queue: DueRow[]; keepByBranch: Map<string, Set<number>> }> {
    const branches = new Set<string>(counters.map((c) => String(c.braname)));
    for (const row of await this.chainPort.listAllBranchPeriods(coopname)) branches.add(String(row.braname));

    const queue: DueRow[] = [];
    const keepByBranch = new Map<string, Set<number>>();
    for (const braname of [...branches].sort()) {
      const rows = (await this.chainPort.listBranchDues(coopname, braname)).map((r) => this.dueRowOf(r)).filter((r) => r.period < current);
      keepByBranch.set(braname, new Set(rows.map((r) => r.period)));
      queue.push(...rows);
    }
    queue.sort((a, b) => a.period - b.period || a.username.localeCompare(b.username));
    return { queue, keepByBranch };
  }

  private dueRowOf(r: MarketContract.Tables.Dues.IKuDue): DueRow {
    const units = (asset: unknown) => this.economyService.assetToUnits(String(asset ?? '0'));
    return {
      username: String(r.username),
      braname: String(r.braname),
      period: Number(r.period),
      turnover: units(r.turnover),
      due: units(r.due),
      retained: units(r.retained),
      orders: Number(r.orders ?? 0),
    };
  }

  /**
   * Итог участка за закончившийся период: расчёт контрактом и зеркало. Сбой
   * расчёта не роняет проход: `false` — участок ждёт следующего прохода, и его
   * более поздние месяцы в этом проходе не считаются. `quiet` — месяц без
   * счётчика участка: строки может не быть, это не сбой.
   */
  private async ensurePeriod(coopname: string, braname: string, period: number, rowsTotal: number, quiet = false): Promise<boolean> {
    try {
      if (quiet) await this.periodService.ensureQuietClosed(coopname, braname, period);
      else await this.periodService.ensureClosed(coopname, braname, period, rowsTotal);
      return true;
    } catch (err: any) {
      const code = chainErrorCode(err);
      if (code === PERIOD_EMPTY) {
        this.logger.warn(`Итог периода ${period} участка ${braname}: контракт не нашёл заказов — счётчик стёрт другим проходом.`);
      } else {
        this.logger.error(`Итог периода ${period} участка ${braname} не рассчитан: ${err.message}`);
      }
      return false;
    }
  }

  /**
   * Одна строка счётчика — одна транзакция `chargeperiod`. Списанное и
   * возвращённое пайщику читаются из операций нитки списания после разбора
   * блока; возмещение паевых взносов инициаторов — разницей счётчика участка до
   * и после. Отказ контракта, когда у пайщика открыт гарантийный возврат, —
   * норма: строка ждёт решения совета.
   */
  private async chargeRow(coopname: string, row: DueRow, summary: ChargedCollector): Promise<boolean> {
    if (row.turnover > 0n) {
      const closed = await this.periodService.adoptClosed(coopname, row.braname, row.period, 0);
      if (!closed) {
        this.logger.warn(`Списание строки пайщика ${row.username} (участок ${row.braname}, период ${row.period}): итог участка не рассчитан — строка ждёт.`);
        return false;
      }
    }
    const repaidBefore = await this.investorRepaidTotal(coopname, row.braname);
    try {
      await this.chainPort.chargePeriod({ coopname, username: row.username, braname: row.braname, period: row.period });
    } catch (err: any) {
      this.logChargeRefusal(row, err);
      return false;
    }

    const parts = await this.chargedParts(coopname, chargeHashOf(coopname, row.username, row.braname, row.period));
    const delta = (await this.investorRepaidTotal(coopname, row.braname)) - repaidBefore;
    const repaid = delta > 0n ? delta : 0n;
    if (repaid > 0n) summary.repaidBranches.add(row.braname);
    await this.periodService.noteCharged(coopname, row.braname, row.period, 1, repaid);

    const periodRow = row.turnover > 0n ? await this.periodService.findOne(coopname, row.braname, row.period) : null;
    const rate = periodRow ? this.periodService.ratePercentOf(periodRow) : FULL_RATE_PERCENT;
    summary.note(row.username, parts.charged, parts.returned, Math.max(1, row.orders), rate);
    return true;
  }

  /**
   * Отказ списания строки в журнал: открытый гарантийный возврат — норма,
   * расхождение счётчика с кошельком — тревога, остальное — предупреждение.
   */
  private logChargeRefusal(row: DueRow, err: any): void {
    const label = `Списание строки пайщика ${row.username} (участок ${row.braname}, период ${row.period})`; // i18n-ignore: строка журнала узла, не текст интерфейса
    const code = chainErrorCode(err);
    if (code === DUE_RETURN_PENDING) {
      this.logger.info(`${label} отложено: открыт гарантийный возврат.`);
    } else if (code === DUE_EXCEEDS) {
      this.logger.error(`${label}: счётчик разошёлся с кошельком (${err.message})`);
    } else if (code === PERIOD_NOT_CLOSED) {
      this.logger.warn(`${label}: итога в цепи нет.`);
    } else {
      this.logger.warn(`${label} не прошло: ${err.message}`);
    }
  }

  /** Списанное и возвращённое по нитке списания — по операциям ledger2, которые провёл контракт. */
  private async chargedParts(coopname: string, hash: string): Promise<{ charged: bigint; returned: bigint }> {
    const result = await this.ledger2History.getHistory({
      coopname,
      processHash: hash,
      actionNames: ['apply'],
      operationCodes: [MarketplaceSecureDueOperation.CHARGE, MarketplaceSecureDueOperation.RETURN_DUE],
      page: 1,
      limit: 50,
    });
    let charged = 0n;
    let returned = 0n;
    for (const op of result.items) {
      const units = this.economyService.assetToUnits(String(op.quantity ?? '0'));
      if (op.operationCode === MarketplaceSecureDueOperation.CHARGE) charged += units;
      if (op.operationCode === MarketplaceSecureDueOperation.RETURN_DUE) returned += units;
    }
    return { charged, returned };
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

  /** Возмещено инициаторам участка всего — строка участка `invbranches` по ключу; нет строки — ноль. */
  private async investorRepaidTotal(coopname: string, braname: string): Promise<bigint> {
    const branch = await this.chainPort.getInvestBranch(coopname, braname);
    return branch ? this.economyService.assetToUnits(String(branch.repaid_total ?? '0')) : 0n;
  }

  private fromDecimal(value: string | null | undefined): bigint {
    return this.economyService.assetToUnits(String(value ?? '0'));
  }
}
