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
import { DomainError, TableStore, chainErrorCode, isNull, lessThan, platformSettings, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
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
import { plannedTargetUnits } from '../shared/planned-target.util';

/** Отказы контракта, которые для прогона — норма, а не сбой. */
const PERIOD_EXISTS = 'MARKETPLACE_PERIOD_EXISTS';
const PERIOD_NOT_CLOSED = 'MARKETPLACE_PERIOD_NOT_CLOSED';

/** Операции служебных записок участка по общему кошельку: выделение под расход и возврат неизрасходованного. */
const MEMO_FUND_CODE = 'o.brn.expfnd';
const MEMO_UNFUND_CODE = 'o.brn.expunf';
/**
 * Выделение из средств инициаторов участка (задача 99D-30) — под служебную
 * записку и под материальную помощь. С задачи 99D-34 траты из средств
 * инициаторов в расходы участка не входят: по этой операции в нитке
 * заявления узел узнаёт, что помощь оплачена ими.
 */
const POOL_FUND_CODE = 'o.mkt.ipool';

/** Сколько операций по общему кошельку участка читается за страницу истории; страницы читаются до последней. */
const HISTORY_PAGE = 200;

/**
 * Распределение участка: изъятие из общего кошелька под распределение
 * (`o.brn.release`, пайщик операции — участок) и зачисление доверенному на
 * персональный кошелёк (`o.brn.person`, пайщик операции — доверенный).
 */
const RELEASE_CODE = 'o.brn.release';
const PERSON_CODE = 'o.brn.person';

/** Контрактная шкала процентов: HUNDR_PERCENTS (1 000 000) = 100 %. */
const HUNDR_PERCENTS = 1_000_000n;

/**
 * Факты закончившегося месяца, которые ИСТОК передаёт контракту (задача 99D-34:
 * расходы по цели резерва). Траты — только из денег участка: средства
 * инициаторов возмещает компенсация инициаторам.
 */
export interface MarketplacePeriodFacts {
  /** ПО — оплачено по плану с общего кошелька участка за месяц. */
  planned: bigint;
  /** СЗ — служебные записки сверх плана с общего кошелька участка за месяц. */
  memos: bigint;
  /** МП — материальная помощь участка с персонального кошелька, выплаченная за месяц. */
  aidPaid: bigint;
  /** ЦП — цель плановых расходов: неоплаченные записи со сроком до конца следующего месяца. */
  plannedTarget: bigint;
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
    const next = this.boundsOf(period + 1);
    const [plans, paidAids] = await Promise.all([
      this.expenseChassis.listPlans(coopname, braname),
      this.aidMirror.paidRowsWithin(coopname, braname, bounds.start, bounds.end),
    ]);
    const planHashes = new Set(plans.map((p) => p.proposalHash?.toLowerCase()).filter((h): h is string => !!h));
    const { planned, memos } = await this.commonSpentWithin(coopname, braname, bounds, planHashes);
    let aidPaid = 0n;
    for (const aid of paidAids) {
      if (!(await this.paidByInitiators(coopname, aid.hash))) aidPaid += aid.amount;
    }
    const plannedTarget = plannedTargetUnits(plans, braname, next.end, (a) => this.economyService.assetToUnits(a));
    return { planned, memos, aidPaid, plannedTarget };
  }

  /**
   * Траты общего кошелька участка за месяц: выделено под расходы минус
   * возвращено неизрасходованное. Записки, которыми оплачены записи реестра
   * планов, — оплачено по плану (ПО), прочие — служебные записки сверх плана
   * (СЗ). Ниже нуля ни то, ни другое не бывает.
   */
  private async commonSpentWithin(coopname: string, braname: string, bounds: PeriodBounds, planHashes: Set<string>): Promise<{ planned: bigint; memos: bigint }> {
    let planned = 0n;
    let memos = 0n;
    for (let page = 1; ; page++) {
      const result = await this.ledger2History.getHistory({
        coopname,
        username: braname,
        actionNames: ['apply'],
        operationCodes: [MEMO_FUND_CODE, MEMO_UNFUND_CODE],
        dateFrom: bounds.start,
        dateTo: bounds.end,
        page,
        limit: HISTORY_PAGE,
      });
      for (const op of result.items) {
        const delta = this.memoDelta(op);
        if (op.processHash && planHashes.has(op.processHash.toLowerCase())) planned += delta;
        else memos += delta;
      }
      // Пустая страница — страховка от неверного числа страниц в ответе истории.
      if (page >= result.totalPages || result.items.length === 0) break;
    }
    return { planned: planned > 0n ? planned : 0n, memos: memos > 0n ? memos : 0n };
  }

  /** Помощь оплачена средствами инициаторов: в нитке заявления есть выделение из их средств. */
  private async paidByInitiators(coopname: string, aidHash: string): Promise<boolean> {
    const result = await this.ledger2History.getHistory({
      coopname,
      processHash: aidHash,
      actionNames: ['apply'],
      operationCodes: [POOL_FUND_CODE],
      page: 1,
      limit: 1,
    });
    return result.items.length > 0;
  }

  /**
   * Сколько участок распределил за месяц: сумма изъятий общего кошелька под
   * распределение. Показ на вкладках «Кошелёк участка» и «Распределение».
   */
  async distributedWithin(coopname: string, braname: string, bounds: PeriodBounds): Promise<bigint> {
    return this.sumWithin(coopname, braname, RELEASE_CODE, bounds);
  }

  /**
   * Сколько пайщик получил распределением за месяц: сумма зачислений на его
   * персональный кошелёк участка. Показ на вкладке «Мои средства».
   */
  async receivedWithin(coopname: string, username: string, bounds: PeriodBounds): Promise<bigint> {
    return this.sumWithin(coopname, username, PERSON_CODE, bounds);
  }

  /**
   * Сумма операций одного кода по одному пайщику в границах месяца. Запрос
   * идёт по индексу истории (пайщик, код, даты): распределение оператор
   * запускает вручную, за месяц таких операций единицы.
   */
  private async sumWithin(coopname: string, username: string, operationCode: string, bounds: PeriodBounds): Promise<bigint> {
    let total = 0n;
    for (let page = 1; ; page++) {
      const result = await this.ledger2History.getHistory({
        coopname,
        username,
        actionNames: ['apply'],
        operationCodes: [operationCode],
        dateFrom: bounds.start,
        dateTo: bounds.end,
        page,
        limit: HISTORY_PAGE,
      });
      for (const op of result.items) total += this.economyService.assetToUnits(String(op.quantity ?? '0'));
      // Пустая страница — страховка от неверного числа страниц в ответе истории.
      if (page >= result.totalPages || result.items.length === 0) break;
    }
    return total;
  }

  /** Сколько одна операция общего кошелька добавляет к тратам месяца: выделение под расход — плюс, возврат неизрасходованного — минус. */
  private memoDelta(op: { quantity?: unknown; operationCode?: string | null }): bigint {
    const units = this.economyService.assetToUnits(String(op.quantity ?? '0'));
    if (op.operationCode === MEMO_FUND_CODE) return units;
    if (op.operationCode === MEMO_UNFUND_CODE) return -units;
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
   * Строка итога периода участка: уже рассчитанная — из зеркала; иначе расчёт
   * контрактом и зеркалирование строки цепи. Стоимость заказов и собранную
   * обеспечительную часть контракт берёт из своего счётчика участка (задача
   * 99D-33); узел передаёт только факты о расходах. `rowsTotal` — строк
   * счётчиков пайщиков за период, столько списаний предстоит. Повторный вызов
   * в том же периоде ничего не пересчитывает.
   */
  async ensureClosed(coopname: string, braname: string, period: number, rowsTotal: number, known?: MarketplacePeriodFacts): Promise<MarketplaceBranchPeriodEntity> {
    const existing = await this.store.findOne({ coopname, braname, period });
    if (existing) return existing;

    const facts = known ?? (await this.collectFacts(coopname, braname, period));
    try {
      await this.chainPort.closePeriod({
        coopname,
        braname,
        period,
        planned: this.economyService.unitsToAsset(facts.planned),
        memos: this.economyService.unitsToAsset(facts.memos),
        aid_paid: this.economyService.unitsToAsset(facts.aidPaid),
        planned_target: this.economyService.unitsToAsset(facts.plannedTarget),
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

  /**
   * Итог месяца без выданных заказов (задача 99D-34): обеспечительной части
   * нет, расходы месяца становятся дефицитом и переходят дальше. Строка в цепи
   * нужна, только если месяцу есть что нести: траты, цель плановых расходов,
   * строки резерва помощи (право получателей копится) или собранная часть
   * цели прошлого итога. Иначе — null, строки нет.
   */
  async ensureQuietClosed(coopname: string, braname: string, period: number): Promise<MarketplaceBranchPeriodEntity | null> {
    const existing = await this.store.findOne({ coopname, braname, period });
    if (existing) return existing;
    const [facts, reserves, fundedPrev] = await Promise.all([
      this.collectFacts(coopname, braname, period),
      this.chainPort.listBranchReserves(coopname, braname),
      this.fundedBefore(coopname, braname, period),
    ]);
    const busy = facts.planned + facts.memos + facts.aidPaid + facts.plannedTarget > 0n || reserves.length > 0 || fundedPrev > 0n;
    if (!busy) return null;
    return this.ensureClosed(coopname, braname, period, 0, facts);
  }

  /**
   * Участки, которым итог месяца нужен и без выданных заказов: со строками
   * итога в цепи, со строками резерва помощи и с записями реестра планов.
   * Все три источника не растут с историей: строки итога — две на участок,
   * резерв — строка на получателя, реестр планов — записи участков.
   */
  async quietCandidates(coopname: string): Promise<string[]> {
    const [periods, reserves, plans] = await Promise.all([
      this.chainPort.listAllBranchPeriods(coopname),
      this.chainPort.listAllBranchReserves(coopname),
      this.expenseChassis.listPlans(coopname, null),
    ]);
    const branches = new Set<string>();
    for (const row of periods) branches.add(String(row.braname));
    for (const row of reserves) branches.add(String(row.braname));
    for (const plan of plans) if (plan.branchName) branches.add(plan.branchName);
    return [...branches].sort();
  }

  /**
   * Собранная часть цели резерва последнего итога участка до периода `period`
   * (F_пр) — по зеркалу итогов. Итог до 99D-34 собранной части не знает: его
   * резерв помощи считался собранным целиком, как и в контракте. Итогов нет — ноль.
   */
  async fundedBefore(coopname: string, braname: string, period: number): Promise<bigint> {
    const prev = await this.store.findOne({ coopname, braname, period: lessThan(period) }, { order: { period: 'DESC' } });
    if (!prev) return 0n;
    return this.economyService.assetToUnits(String(prev.target_funded ?? prev.aid_reserve));
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
      planned_target: row.planned_target ? dec(row.planned_target) : null,
      target: row.target ? dec(row.target) : null,
      target_prev: row.target_prev ? dec(row.target_prev) : null,
      target_funded: row.target_funded ? dec(row.target_funded) : null,
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
   * расчётом нового итога. Период, у которого в цепи ещё есть несписанные
   * строки счётчиков пайщиков (`keep`), не стирается: их списание идёт по его
   * ставкам (задача 99D-33).
   */
  async pruneOld(coopname: string, braname: string, currentPeriod: number, keep: ReadonlySet<number> = new Set()): Promise<void> {
    const rows = await this.store.find({ coopname, braname, deleted_at: isNull() });
    for (const row of rows) {
      if (row.period >= currentPeriod - 1 || keep.has(row.period)) continue;
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
