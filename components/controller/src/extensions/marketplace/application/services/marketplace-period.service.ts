import { Inject, Injectable } from '@nestjs/common';
import { MarketContract } from 'cooptypes';
import {
  EXPENSE_CHASSIS_PORT,
  LEDGER2_HISTORY_PORT,
  LOGGER_PORT,
  type IExpenseChassisPort,
  type ILedger2HistoryPort,
  type ILoggerPort,
} from '@coopenomics/innercoop';
import { DomainError, TableStore, chainErrorCode, isNull, platformSettings, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { MARKETPLACE_BRANCH_PERIOD_STORE } from '../../infrastructure/database/marketplace-stores';
import { MarketplaceBranchPeriodEntity } from '../../infrastructure/entities/marketplace-branch-period.entity';
import { MarketplacePeriodInvestPhase } from '../../domain/entities/marketplace-branch-period.types';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import { MarketplaceBranchAidMirrorService } from './marketplace-branch-aid-mirror.service';
import { periodBounds, type PeriodBounds } from '../shared/period-bounds';

/** Отказы контракта, которые для прогона — норма, а не сбой. */
const PERIOD_EXISTS = 'MARKETPLACE_PERIOD_EXISTS';
const PERIOD_NOT_CLOSED = 'MARKETPLACE_PERIOD_NOT_CLOSED';

/** Операции служебных записок участка по общему кошельку: выделение под расход и возврат неизрасходованного. */
const MEMO_FUND_CODE = 'o.brn.expfnd';
const MEMO_UNFUND_CODE = 'o.brn.expunf';
/**
 * Те же записки, оплаченные из средств инициаторов участка (задача 99D-30):
 * выделение и возврат остатка по пулу инициаторов. Выделение под
 * материальную помощь идёт той же операцией — его отличает хэш заявления.
 */
const POOL_FUND_CODE = 'o.mkt.ipool';
const POOL_UNFUND_CODE = 'o.mkt.iunpl';

/** Сколько операций по общему кошельку участка читается за страницу истории; страницы читаются до последней. */
const HISTORY_PAGE = 200;

/** Контрактная шкала процентов: HUNDR_PERCENTS (1 000 000) = 100 %. */
const HUNDR_PERCENTS = 1_000_000n;

/** Факты закончившегося месяца, которые ИСТОК передаёт контракту. */
export interface MarketplacePeriodFacts {
  /** ПР — плановые расходы участка со сроком внутри месяца. */
  planned: bigint;
  /** СЗ — служебные записки участка сверх плана за месяц. */
  memos: bigint;
  /** МП — материальная помощь участка, выплаченная за месяц. */
  aidPaid: bigint;
}

/**
 * Итог месяца кооперативного участка (задача 99D-22, КЭУ-4; документ модели,
 * разделы 7, 8, 12).
 *
 * ИСТОК собирает факты закончившегося месяца и передаёт их контракту вместе со
 * стоимостью заказов прогона и собранной обеспечительной частью; контракт
 * считает членский взнос участка, фонды, долю инициатора, возврат и ставки
 * (`closeperiod`). ИСТОК ничего не умножает на ставки и проценты: плановые
 * расходы складывает по реестру планов, служебные записки — по операциям
 * ledger2 общего кошелька участка, материальную помощь — по зеркалу заявлений.
 *
 * В цепи у участка лежат только две строки итога; история всех прогонов — в
 * зеркале узла `marketplace_branch_period`: его заполняет этот сервис после
 * расчёта, читая строку цепи, и по нему строятся экраны экономики участка.
 */
@Injectable()
export class MarketplacePeriodService {
  constructor(
    @Inject(MARKETPLACE_BRANCH_PERIOD_STORE)
    private readonly store: TableStore<MarketplaceBranchPeriodEntity>,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(EXPENSE_CHASSIS_PORT)
    private readonly expenseChassis: IExpenseChassisPort,
    @Inject(LEDGER2_HISTORY_PORT)
    private readonly ledger2History: ILedger2HistoryPort,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    private readonly aidMirror: MarketplaceBranchAidMirrorService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplacePeriodService.name);
  }

  /** Границы месяца по его номеру в часовом поясе кооператива. */
  boundsOf(period: number): PeriodBounds {
    return periodBounds(period, platformSettings().timezone || 'UTC');
  }

  // ── Факты месяца ──────────────────────────────────────────────────────

  async collectFacts(coopname: string, braname: string, period: number): Promise<MarketplacePeriodFacts> {
    const bounds = this.boundsOf(period);
    const [plans, aidPaid] = await Promise.all([
      this.expenseChassis.listPlans(coopname, braname),
      this.aidMirror.paidWithin(coopname, braname, bounds.start, bounds.end),
    ]);
    const planned = plans
      .filter((p) => p.branchName === braname && p.dueDate && p.dueDate >= bounds.start && p.dueDate < bounds.end)
      .reduce((sum, p) => sum + this.economyService.assetToUnits(p.amount), 0n);
    const planHashes = new Set(plans.map((p) => p.proposalHash?.toLowerCase()).filter((h): h is string => !!h));
    const memos = await this.memosWithin(coopname, braname, bounds, planHashes);
    return { planned, memos, aidPaid };
  }

  /**
   * Служебные записки участка сверх плана за месяц: выделено под расходы минус
   * возвращено неизрасходованное, без записок, которыми оплачены записи
   * реестра планов — они уже в плановых расходах.
   */
  private async memosWithin(coopname: string, braname: string, bounds: PeriodBounds, planHashes: Set<string>): Promise<bigint> {
    let total = 0n;
    for (let page = 1; ; page++) {
      const result = await this.ledger2History.getHistory({
        coopname,
        username: braname,
        actionNames: ['apply'],
        operationCodes: [MEMO_FUND_CODE, MEMO_UNFUND_CODE, POOL_FUND_CODE, POOL_UNFUND_CODE],
        dateFrom: bounds.start,
        dateTo: bounds.end,
        page,
        limit: HISTORY_PAGE,
      });
      for (const op of result.items) {
        if (op.operationCode === POOL_FUND_CODE && op.processHash && (await this.aidMirror.isAidHash(coopname, op.processHash))) continue;
        total += this.memoDelta(op, planHashes);
      }
      // Пустая страница — страховка от неверного числа страниц в ответе истории.
      if (page >= result.totalPages || result.items.length === 0) break;
    }
    return total > 0n ? total : 0n;
  }

  /**
   * Сколько одна операция общего кошелька добавляет к служебным запискам месяца: выделение
   * под расход — плюс, возврат неизрасходованного — минус; записка по записи
   * реестра планов уже учтена в плановых расходах и не считается.
   */
  private memoDelta(op: { processHash?: string | null; quantity?: unknown; operationCode?: string | null }, planHashes: Set<string>): bigint {
    if (op.processHash && planHashes.has(op.processHash.toLowerCase())) return 0n;
    const units = this.economyService.assetToUnits(String(op.quantity ?? '0'));
    if (op.operationCode === MEMO_FUND_CODE || op.operationCode === POOL_FUND_CODE) return units;
    if (op.operationCode === MEMO_UNFUND_CODE || op.operationCode === POOL_UNFUND_CODE) return -units;
    return 0n;
  }

  // ── Расчёт и зеркало ───────────────────────────────────────────────────

  /**
   * Итог месяца участка, рассчитанный прежним проходом: из зеркала, а если
   * зеркало его не дождалось — из строки цепи с записью в зеркало. Нет ни там,
   * ни там — null: итог ещё не считался, список прогона открыт.
   */
  async adoptClosed(coopname: string, braname: string, period: number, rowsTotal: number): Promise<MarketplaceBranchPeriodEntity | null> {
    const existing = await this.store.findOne({ coopname, braname, period });
    if (existing) return existing;
    const chainRow = (await this.chainPort.listBranchPeriods(coopname, braname)).find((r) => Number(r.period) === period);
    return chainRow ? this.mirror(coopname, chainRow, rowsTotal) : null;
  }

  /**
   * Строка итога месяца участка: уже рассчитанная — из зеркала; иначе расчёт
   * контрактом по фактам и зеркалирование строки цепи. Повторный вызов в том
   * же месяце ничего не пересчитывает.
   */
  async ensureClosed(
    coopname: string,
    braname: string,
    period: number,
    turnover: bigint,
    secured: bigint,
    rowsTotal: number
  ): Promise<MarketplaceBranchPeriodEntity> {
    const existing = await this.store.findOne({ coopname, braname, period });
    if (existing) return existing;

    const facts = await this.collectFacts(coopname, braname, period);
    try {
      await this.chainPort.closePeriod({
        coopname,
        braname,
        period,
        turnover: this.economyService.unitsToAsset(turnover),
        secured: this.economyService.unitsToAsset(secured),
        planned: this.economyService.unitsToAsset(facts.planned),
        memos: this.economyService.unitsToAsset(facts.memos),
        aid_paid: this.economyService.unitsToAsset(facts.aidPaid),
      });
    } catch (err: any) {
      // Итог уже рассчитан прежним проходом, а зеркало его не дождалось —
      // читаем строку цепи как есть; любой другой отказ — сбой прогона.
      if (chainErrorCode(err) !== PERIOD_EXISTS) throw err;
    }

    const chainRow = (await this.chainPort.listBranchPeriods(coopname, braname)).find((r) => Number(r.period) === period);
    if (!chainRow) {
      throw DomainError.internal('MARKETPLACE_PERIOD_NOT_IN_CHAIN', { braname, period });
    }
    return this.mirror(coopname, chainRow, rowsTotal);
  }

  /** Зеркало строки цепи в базе узла. */
  async mirror(coopname: string, row: MarketContract.Tables.Periods.IKuPeriod, rowsTotal: number): Promise<MarketplaceBranchPeriodEntity> {
    const dec = (asset: unknown) => this.toDecimal(this.economyService.assetToUnits(String(asset ?? '0')));
    const key = { coopname, braname: String(row.braname), period: Number(row.period) };
    const fields: Partial<MarketplaceBranchPeriodEntity> = {
      ...key,
      turnover: dec(row.turnover),
      secured: dec(row.secured),
      planned: dec(row.planned),
      memos: dec(row.memos),
      aid_paid: dec(row.aid_paid),
      aid_reserve: dec(row.aid_reserve),
      aid_unpaid: dec(row.aid_unpaid),
      expenses: dec(row.expenses),
      membership: dec(row.membership),
      funds_amount: dec(row.funds_amount),
      branch_amount: dec(row.branch_amount),
      initiator_amount: dec(row.initiator_amount),
      return_amount: dec(row.return_amount),
      deficit: dec(row.deficit),
      rate_branch: String(row.rate_branch),
      rate_funds: String(row.rate_funds),
      rate_initiator: String(row.rate_initiator),
      initiator: String(row.initiator),
      rows_total: rowsTotal,
      rows_charged: 0,
      // time_point_sec цепи приходит без признака пояса — это UTC.
      closed_at: new Date(String(row.closed_at).endsWith('Z') ? String(row.closed_at) : `${row.closed_at}Z`),
      deleted_at: null,
    };
    const existing = await this.store.findOne(key);
    if (existing) {
      // Фаза и возмещение прогона — история этого месяца: повторное зеркало их не переписывает.
      await this.store.update(key, { ...fields, rows_total: Math.max(existing.rows_total, rowsTotal), rows_charged: existing.rows_charged });
      return { ...existing, ...fields, rows_total: Math.max(existing.rows_total, rowsTotal), rows_charged: existing.rows_charged };
    }
    const invest_phase = await this.investPhaseOf(coopname, key.braname, this.economyService.assetToUnits(String(row.deficit ?? '0')));
    return this.store.insert({ ...fields, invest_phase, investor_repaid: this.toDecimal(0n) });
  }

  /**
   * Фаза участка по паевым взносам инициаторов при расчёте итога (задача 99D-30):
   * по строке участка `invbranches` — паевые взносы есть ли, остаток к возврату по
   * формуле контракта (`PeriodModel.crpsOutstanding`) — и по недостаче месяца.
   */
  private async investPhaseOf(coopname: string, braname: string, deficit: bigint): Promise<MarketplacePeriodInvestPhase> {
    const branch = await this.chainPort.getInvestBranch(coopname, braname);
    const units = (asset: unknown) => this.economyService.assetToUnits(String(asset ?? '0'));
    if (!branch || units(branch.money_total) + units(branch.property_total) <= 0n) return MarketplacePeriodInvestPhase.NONE;
    if (deficit > 0n) return MarketplacePeriodInvestPhase.DEFICIT;
    const outstanding = MarketContract.PeriodModel.crpsOutstanding({
      base: BigInt(branch.base ?? 0),
      acc: BigInt(branch.acc ?? 0),
      sJoin: BigInt(branch.s_join ?? 0),
      sFixed: BigInt(branch.s_fixed ?? 0),
      unusedTotal: units(branch.unused_total),
      reserved: units(branch.reserved),
    });
    return outstanding > 0n ? MarketplacePeriodInvestPhase.REPAYING : MarketplacePeriodInvestPhase.BRANCH;
  }

  /** Строк прогона списано ещё `count`; доля инициаторов по ним возместила паевые взносы на `investorRepaid`. */
  async noteCharged(coopname: string, braname: string, period: number, count: number, investorRepaid = 0n): Promise<void> {
    const row = await this.store.findOne({ coopname, braname, period });
    if (!row) return;
    const repaid = this.economyService.assetToUnits(String(row.investor_repaid ?? '0')) + investorRepaid;
    await this.store.update({ coopname, braname, period }, { rows_charged: row.rows_charged + count, investor_repaid: this.toDecimal(repaid) });
  }

  /**
   * В цепи у участка остаются итоги текущего и прошлого месяца: прошлый нужен
   * ради невыплаченной части резерва. Более старые строки стираются перед
   * расчётом нового итога.
   */
  async pruneOld(coopname: string, braname: string, currentPeriod: number): Promise<void> {
    const rows = await this.store.find({ coopname, braname, deleted_at: isNull() });
    for (const row of rows) {
      if (row.period >= currentPeriod - 1) continue;
      try {
        await this.chainPort.deletePeriod({ coopname, braname, period: row.period });
      } catch (err: any) {
        // Строки в цепи уже нет — зеркало просто отмечает это.
        if (chainErrorCode(err) !== PERIOD_NOT_CLOSED) {
          this.logger.warn(`Итог месяца ${row.period} участка ${braname} не стёрт из цепи: ${err.message}`);
          continue;
        }
      }
      await this.store.update({ coopname, braname, period: row.period }, { deleted_at: new Date() });
    }
  }

  // ── Чтение для экранов ─────────────────────────────────────────────────

  async listForBranch(coopname: string, braname: string, options?: PaginationInputDTO): Promise<PaginationResult<MarketplaceBranchPeriodEntity>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 24;
    const [items, totalCount] = await this.store.findAndCount(
      { coopname, braname },
      { order: { period: 'DESC' }, limit, offset: (page - 1) * limit }
    );
    return { items, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)), currentPage: page };
  }

  async findOne(coopname: string, braname: string, period: number): Promise<MarketplaceBranchPeriodEntity | null> {
    return this.store.findOne({ coopname, braname, period });
  }

  /** Коэффициент экономического участия за месяц в процентах с двумя знаками: участку + фонды + инициатору. */
  ratePercentOf(row: Pick<MarketplaceBranchPeriodEntity, 'rate_branch' | 'rate_funds' | 'rate_initiator'>): string {
    const total = BigInt(row.rate_branch || '0') + BigInt(row.rate_funds || '0') + BigInt(row.rate_initiator || '0');
    // Доли HUNDR_PERCENTS → проценты с двумя знаками: 156 666 → 15,67 %.
    const hundredths = (total * 10_000n + HUNDR_PERCENTS / 2n) / HUNDR_PERCENTS;
    return `${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}`;
  }

  private toDecimal(units: bigint): string {
    return this.economyService.unitsToAsset(units).split(' ')[0] ?? '0';
  }
}
