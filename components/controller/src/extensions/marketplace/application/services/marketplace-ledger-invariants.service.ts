import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  LEDGER2_HISTORY_PORT,
  LOGGER_PORT,
  USER_WALLET_PORT,
  type ILedger2HistoryPort,
  type ILoggerPort,
  type InnerLedger2Operation,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  checkAllMarketplaceLedger2Invariants,
  type InvariantResult,
  type MarketplaceAccountRow,
  type MarketplaceLedger2OperationRow,
  type MarketplaceOpenSettlementRow,
  type MarketplaceWalletRow,
} from '../invariants/marketplace-ledger2-invariants';

/** Страница истории учёта за один запрос к порту. */
const HISTORY_PAGE_LIMIT = 500;

/** Счета и кошельки в истории идут со сдвигом ×1000 (51000 → 51); инварианты считают по номеру плана счетов. */
function normalizeAccountId(id: number | null | undefined): number | null {
  if (id === null || id === undefined) return null;
  return id >= 1000 ? Math.trunc(id / 1000) : id;
}

/** Кошелёк признанного гарантийного долга поставщиков (ledger2 `w.mkt.debt`). */
const SUPPLIER_DEBT_WALLET = 'w.mkt.debt';

/**
 * Срез истории учёта, дочитываемый по страницам. История только растёт
 * (journal append-only), поэтому следующая сверка продолжает с той
 * страницы, где остановилась прошлая; форк цепи может убрать хвост — тогда
 * последняя строка кеша не найдётся на своём месте, и срез читается заново.
 */
interface HistoryCache {
  coopname: string;
  rows: MarketplaceLedger2OperationRow[];
}

/**
 * Сверка инвариантов учёта Стола заказов на живых данных (задача 99D-14).
 *
 * Агрегаторы I1–I7 (`invariants/marketplace-ledger2-invariants.ts`) чистые:
 * здесь они получают срез истории учёта, остатки счетов и кошельков из ядра
 * через порты и открытые расчёты с поставщиками из проекции заказов. Прогон
 * два: по часам с предупреждением в журнал и по запросу председателя с
 * выдачей результата на стол.
 */
@Injectable()
export class MarketplaceLedgerInvariantsService {
  private historyCache: HistoryCache | null = null;

  constructor(
    @Inject(LEDGER2_HISTORY_PORT) private readonly ledger: ILedger2HistoryPort,
    @Inject(USER_WALLET_PORT) private readonly userWallets: IUserWalletPort,
    @Inject(MARKETPLACE_ORDER_REPOSITORY) private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceLedgerInvariantsService.name);
  }

  async check(coopname: string): Promise<InvariantResult[]> {
    const [rows, accounts, wallets, settlements] = await Promise.all([
      this.loadHistory(coopname),
      this.loadAccounts(coopname),
      this.loadWallets(coopname),
      this.loadOpenSettlements(coopname),
    ]);
    return checkAllMarketplaceLedger2Invariants(rows, wallets, accounts, settlements);
  }

  /**
   * Часовая сверка: нарушение — предупреждение в журнал с ожидаемым и
   * фактическим значением. Ничего не чинит: расхождение в учёте разбирает
   * человек, а не крон.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async triggerHourlyCheck(): Promise<void> {
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    let results: InvariantResult[];
    try {
      results = await this.check(coopname);
    } catch (e) {
      this.logger.warn(`[LEDGER_INVARIANTS] сверка не выполнена: ${(e as Error).message}`);
      return;
    }
    const broken = results.filter((r) => !r.ok);
    if (broken.length === 0) {
      this.logger.debug(`[LEDGER_INVARIANTS] все ${results.length} инвариантов Стола заказов сходятся (coopname=${coopname})`);
      return;
    }
    for (const r of broken) {
      this.logger.warn(
        `[LEDGER_INVARIANTS] ${r.violation ?? r.invariant}: ожидалось ${r.expected ?? '∅'}, фактически ${r.actual ?? '∅'}` +
          (r.details?.length ? `; ниток: ${r.details.length}` : '')
      );
    }
  }

  /**
   * История учёта — дочитыванием: страницы, уже лежащие в кеше, повторно не
   * читаются (задача 99D-15: часовая сверка перечитывала всю историю
   * кооператива). Кеш живёт в памяти процесса и валиден, пока его последняя
   * строка стоит на своём месте в цепи; иначе — полное чтение.
   */
  private async loadHistory(coopname: string): Promise<MarketplaceLedger2OperationRow[]> {
    const cache = this.historyCache;
    const cached = cache && cache.coopname === coopname ? cache.rows : [];
    const rows = (await this.isCacheStillValid(coopname, cached)) ? [...cached] : [];
    const fullPages = Math.floor(rows.length / HISTORY_PAGE_LIMIT);
    rows.length = fullPages * HISTORY_PAGE_LIMIT;
    for (let page = fullPages + 1; ; page++) {
      const resp = await this.fetchPage(coopname, page);
      rows.push(...resp.items.map((op) => this.toRow(op)));
      if (resp.items.length < HISTORY_PAGE_LIMIT || page >= resp.totalPages) break;
    }
    this.historyCache = { coopname, rows };
    return rows;
  }

  /** Последняя полная страница кеша обязана заканчиваться той же строкой, что и в цепи. */
  private async isCacheStillValid(coopname: string, cached: readonly MarketplaceLedger2OperationRow[]): Promise<boolean> {
    const fullPages = Math.floor(cached.length / HISTORY_PAGE_LIMIT);
    if (fullPages === 0) return false;
    const resp = await this.fetchPage(coopname, fullPages);
    const last = resp.items[resp.items.length - 1];
    return !!last && last.globalSequence === cached[fullPages * HISTORY_PAGE_LIMIT - 1]?.globalSequence;
  }

  private fetchPage(coopname: string, page: number) {
    return this.ledger.getHistory({ coopname, page, limit: HISTORY_PAGE_LIMIT, sortOrder: 'ASC' });
  }

  private toRow(op: InnerLedger2Operation): MarketplaceLedger2OperationRow {
    return {
      globalSequence: op.globalSequence,
      action: op.action as MarketplaceLedger2OperationRow['action'],
      operationCode: op.operationCode ?? null,
      processHash: op.processHash ?? null,
      walletFrom: op.walletFrom ?? null,
      walletTo: op.walletTo ?? null,
      accountId: normalizeAccountId(op.accountId),
      quantity: op.quantity ?? null,
      parentApplyGlobalSequence: op.parentApplyGlobalSequence ?? null,
    };
  }

  private async loadAccounts(coopname: string): Promise<MarketplaceAccountRow[]> {
    const accounts = await this.ledger.getAccounts(coopname);
    return accounts
      .map((a) => ({ accountId: normalizeAccountId(a.id), balance: a.balance }))
      .filter((a): a is MarketplaceAccountRow => a.accountId !== null);
  }

  /**
   * Остатки общекооперативных кошельков плюс сумма долей поставщиков в
   * кошельке признанного долга: он ведётся по пайщикам, в общем списке его
   * остатка нет, а I7 нужен именно он.
   */
  private async loadWallets(coopname: string): Promise<MarketplaceWalletRow[]> {
    const [wallets, debtRows] = await Promise.all([
      this.ledger.getWallets(coopname),
      this.userWallets.findByWallet(coopname, SUPPLIER_DEBT_WALLET),
    ]);
    const out: MarketplaceWalletRow[] = wallets
      .filter((w) => w.id !== SUPPLIER_DEBT_WALLET)
      .map((w) => ({ wallet: w.id, balance: w.available }));
    for (const row of debtRows) {
      if (row.available) out.push({ wallet: SUPPLIER_DEBT_WALLET, balance: row.available });
    }
    return out;
  }

  /**
   * Открытые расчёты с поставщиками. Принятую стоимость инвариант берёт из
   * истории (o.mkt.purch нитки заказа); значение из проекции — запасное для
   * заказов, принятых до появления поля `accepted_cost`, у которых нитки в
   * срезе нет.
   */
  private async loadOpenSettlements(coopname: string): Promise<MarketplaceOpenSettlementRow[]> {
    const orders = await this.orderRepo.listOpenSupplierSettlements(coopname);
    return orders.map((o) => ({ processHash: o.order_hash, acceptedCost: o.accepted_cost }));
  }
}

export const MARKETPLACE_LEDGER_INVARIANTS_SERVICE = Symbol('MARKETPLACE_LEDGER_INVARIANTS_SERVICE');
