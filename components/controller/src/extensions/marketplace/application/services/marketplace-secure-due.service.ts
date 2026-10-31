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
import { TableStore, chainErrorCode, isNull, lessOrEqual, platformSettings } from '@coopenomics/extension-kit';
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
}

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

/** Номер месяца в часовом поясе кооператива: год × 12 + месяц. */
export function monthKey(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 0);
  return year * 12 + month;
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
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
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
    [MarketplaceSecureDueOperation.CHARGE]: (op) => this.reduce(op.hash, op, true),
    [MarketplaceSecureDueOperation.UNDUE]: (op) => this.reduceByClaim(op),
    [MarketplaceSecureDueOperation.EXIT]: (op) => this.settleOnExit(op),
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
    await this.reduce(claim.order_hash.toLowerCase(), op, false);
  }

  /** Списание или гарантийный возврат уменьшают остаток к списанию. */
  private async reduce(order_hash: string, op: AppliedOperation, charged: boolean): Promise<void> {
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
        charged_amount: charged ? this.toDecimal(this.fromDecimal(row.charged_amount) + op.units) : row.charged_amount,
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

  // ── Списание первого числа ──────────────────────────────────────────

  /**
   * Раз в час: строки, созревшие до начала текущего месяца по часовому поясу
   * кооператива, списываются. Первый прогон месяца — в первый час первого
   * числа; остальные прогоны дописывают то, что не прошло.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
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

    const chargedByUser = new Map<string, { units: bigint; orders: number }>();
    let charged = 0;
    let failed = 0;
    for (const row of ripe.filter((r) => !blocked.has(r.order_hash))) {
      const units = await this.chargeRow(coopname, row);
      if (units === null) {
        failed++;
        continue;
      }
      charged++;
      const acc = chargedByUser.get(row.username) ?? { units: 0n, orders: 0 };
      chargedByUser.set(row.username, { units: acc.units + units, orders: acc.orders + 1 });
    }
    this.logger.info(`Списание обеспечительной части: списано ${charged}, не прошло ${failed} (coopname=${coopname})`);
    await this.notifyCharged(coopname, chargedByUser);
    return { charged, failed };
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

  /** Письмо пайщику — одно за прогон и только если по нему что-то списано. */
  private async notifyCharged(coopname: string, chargedByUser: Map<string, { units: bigint; orders: number }>): Promise<void> {
    for (const [username, { units, orders }] of chargedByUser) {
      if (units <= 0n) continue;
      try {
        const payload: Workflows.MarketplaceSecurePartCharged.IPayload = {
          userName: await this.accountPort.getDisplayName(username),
          amount: this.economyService.unitsToAsset(units),
          ordersCount: String(orders),
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
