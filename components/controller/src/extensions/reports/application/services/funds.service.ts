import { Inject, Injectable } from '@nestjs/common';
import { FundContract, Ledger2 } from 'cooptypes';
import {
  LEDGER2_HISTORY_PORT,
  type ILedger2HistoryPort,
  type InnerLedger2Operation,
} from '@coopenomics/innercoop';
import { DomainError, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import {
  FUND_REGISTRY_BLOCKCHAIN_PORT,
  type FundRegistryBlockchainPort,
} from '../../domain/ports/fund-registry-blockchain.port';
import {
  ReportsFundKind,
  ReportsFundMovementDirection,
  type ReportsEditFundInputDTO,
  type ReportsFundDTO,
  type ReportsFundHistoryInputDTO,
  type ReportsFundMovementDTO,
  type ReportsFundsInputDTO,
  type ReportsFundsRegistryDTO,
} from '../dto/funds.dto';

/** Процент в контракте — ×10 000 (1 % = 10 000), в ответе — проценты с сотыми. */
const PERCENT_UNITS = 10_000;
const HUNDRED_PERCENT_UNITS = 100 * PERCENT_UNITS;

/**
 * Операции транзита через фонд (задача 99D-25): перевод с пула на кошелёк фонда
 * перед выплатой и обратно после возврата аванса. В истории фонда их нет — они
 * парные к списанию и возврату в той же транзакции и остаток фонда не меняют;
 * бухгалтер видит одну строку «расход» или «возврат» на каждую выплату.
 */
const TRANSIT_CODES: ReadonlySet<string> = new Set([
  'o.brn.tofund',
  'o.brn.fmfund',
  'o.edu.tofund',
  'o.edu.fmfund',
  'o.brn.aidfnd',
]);

/** Пул расходов программы «Благорост»: вложения на счёте 08 — справочная строка реестра фондов (до ответа бухгалтера, BB1-2). */
const INVESTMENTS_WALLET = 'w.cap.pgexp';
const INVESTMENTS_ACCOUNT = 8_000;
const INVESTMENTS_ID = 0;

/** Страница истории при подсчёте оборотов за период и предел страниц. */
const TURNOVER_PAGE = 500;
const TURNOVER_MAX_PAGES = 40;

/** Направление операции относительно кошелька по реестру операций. */
interface WalletOperation {
  code: string;
  direction: ReportsFundMovementDirection;
  counterparty: string | null;
}

/** Сумма в единицах цепи с символом и точностью строки «123.4500 RUB». */
interface Money {
  units: bigint;
  symbol: string;
  precision: number;
}

function parseMoney(quantity: string | null | undefined): Money | null {
  if (!quantity) return null;
  const [amount, symbol = ''] = quantity.trim().split(/\s+/);
  const [whole, frac = ''] = amount.split('.');
  const negative = whole.startsWith('-');
  const digits = `${whole.replace('-', '')}${frac}`.replace(/\D/g, '');
  if (!digits) return null;
  const units = BigInt(digits) * (negative ? -1n : 1n);
  return { units, symbol, precision: frac.length };
}

/** Накопитель оборотов кошелька: точность и символ берутся из первой операции. */
interface Turnover {
  income: bigint;
  outcome: bigint;
  precision: number;
  symbol: string;
  seen: boolean;
}

function addToTurnover(acc: Turnover, op: InnerLedger2Operation, byCode: Map<string, ReportsFundMovementDirection>): void {
  const money = parseMoney(op.quantity);
  const direction = byCode.get(op.operationCode ?? '');
  if (!money || !direction) return;
  if (!acc.seen) {
    acc.precision = money.precision;
    acc.symbol = money.symbol || acc.symbol;
    acc.seen = true;
  }
  if (direction === ReportsFundMovementDirection.IN) acc.income += money.units;
  else acc.outcome += money.units;
}

/** Название кошелька другой стороны движения; у выплат за пределы кооператива его нет. */
function counterpartyName(wallet: string | null): string | null {
  if (!wallet) return null;
  return Ledger2.getWalletHumanName(wallet) ?? null;
}

function formatMoney(units: bigint, symbol: string, precision: number): string {
  const negative = units < 0n;
  const abs = (negative ? -units : units).toString().padStart(precision + 1, '0');
  const whole = abs.slice(0, abs.length - precision) || '0';
  const frac = precision ? `.${abs.slice(abs.length - precision)}` : '';
  return `${negative ? '-' : ''}${whole}${frac}${symbol ? ` ${symbol}` : ''}`;
}

/**
 * Фонды кооператива для стола бухгалтера (задача 99D-24).
 *
 * Реестр фондов — пять строк настроек контракта fund; остаток каждого фонда —
 * его кошелёк учётной книги (кошелёк и есть субсчёт фонда); обороты и история
 * — операции учётной книги, у которых кошелёк фонда стоит источником или
 * получателем. Код операции говорит, с какой стороны стоит фонд, — так история
 * получает знак суммы без разбора движений по кошелькам.
 */
@Injectable()
export class FundsService {
  constructor(
    @Inject(FUND_REGISTRY_BLOCKCHAIN_PORT) private readonly registry: FundRegistryBlockchainPort,
    @Inject(LEDGER2_HISTORY_PORT) private readonly ledger: ILedger2HistoryPort
  ) {}

  /** Реестр фондов с остатками и оборотами за период; справкой — вложения «Благороста». */
  async registryView(input: ReportsFundsInputDTO): Promise<ReportsFundsRegistryDTO> {
    const [rows, wallets] = await Promise.all([
      this.registry.listFunds(input.coopname),
      this.ledger.getWallets(input.coopname),
    ]);
    const availableOf = new Map(wallets.map((w) => [w.id, w.available]));
    const symbol = this.symbolOf(wallets.map((w) => w.available));

    const funds: ReportsFundDTO[] = [];
    for (const row of rows) {
      funds.push(await this.fundView(input, row, availableOf, symbol));
    }
    const investments = await this.investmentsView(input, availableOf, symbol);
    const percent_sum = funds
      .filter((f) => f.kind === ReportsFundKind.ACCUMULATION)
      .reduce((sum, f) => sum + f.percent, 0);
    return { funds, percent_sum: Math.round(percent_sum * 100) / 100, investments };
  }

  /** История движений одного фонда по страницам: только операции, меняющие остаток фонда. */
  async history(
    input: ReportsFundHistoryInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ReportsFundMovementDTO>> {
    const row = await this.fundRow(input.coopname, input.fund_id);
    const operations = this.operationsOfWallet(String(row.wallet));
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    if (!operations.length) {
      return { items: [], totalCount: 0, totalPages: 0, currentPage: page };
    }
    const resp = await this.ledger.getHistory({
      coopname: input.coopname,
      actionNames: ['apply'],
      operationCodes: operations.map((o) => o.code),
      dateFrom: input.date_from,
      dateTo: input.date_to,
      page,
      limit,
      sortOrder: options?.sortOrder === 'ASC' ? 'ASC' : 'DESC',
    });
    const byCode = new Map(operations.map((o) => [o.code, o]));
    return {
      items: resp.items
        .map((op) => this.movementView(op, byCode))
        .filter((m): m is ReportsFundMovementDTO => m !== null),
      totalCount: resp.totalCount,
      totalPages: resp.totalPages,
      currentPage: resp.currentPage,
    };
  }

  /**
   * Правка описания и процента фонда председателем. Правила контракта
   * проверяются до цепи, чтобы отказ пришёл понятным: процент фонда накопления
   * в (0; 100], у фонда списания 0, сумма процентов фондов накопления не выше
   * 100 %. Контракт сверяет имя председателя сам.
   */
  async editFund(input: ReportsEditFundInputDTO, chairman: string): Promise<ReportsFundDTO> {
    const rows = await this.registry.listFunds(input.coopname);
    const row = rows.find((r) => Number(r.id) === input.fund_id);
    if (!row) throw DomainError.notFound('REPORTS_FUND_NOT_FOUND', { fundId: input.fund_id });

    const isAccumulation = String(row.kind) === FundContract.Tables.Funds.KIND_ACCUMULATION;
    const percentUnits = Math.round(input.percent * PERCENT_UNITS);
    if (isAccumulation) {
      if (percentUnits <= 0 || percentUnits > HUNDRED_PERCENT_UNITS) {
        throw DomainError.badRequest('REPORTS_FUND_PERCENT_INVALID');
      }
      const others = rows
        .filter((r) => String(r.kind) === FundContract.Tables.Funds.KIND_ACCUMULATION && Number(r.id) !== input.fund_id)
        .reduce((sum, r) => sum + Number(r.percent), 0);
      if (others + percentUnits > HUNDRED_PERCENT_UNITS) {
        throw DomainError.badRequest('REPORTS_FUND_PERCENT_SUM_EXCEEDED', {
          sum: (others + percentUnits) / PERCENT_UNITS,
        });
      }
    } else if (percentUnits !== 0) {
      throw DomainError.badRequest('REPORTS_FUND_PERCENT_NOT_ALLOWED');
    }

    await this.registry.editFund({
      coopname: input.coopname,
      username: chairman,
      type: isAccumulation ? 'accumulation' : 'expend',
      fund_id: input.fund_id,
      contract: '',
      name: row.name,
      description: input.description,
      percent: percentUnits,
    });

    const after = await this.fundRow(input.coopname, input.fund_id);
    const wallets = await this.ledger.getWallets(input.coopname);
    const availableOf = new Map(wallets.map((w) => [w.id, w.available]));
    return this.fundView({ coopname: input.coopname }, after, availableOf, this.symbolOf(wallets.map((w) => w.available)));
  }

  // ── внутреннее ──────────────────────────────────────────────────────────────

  private async fundRow(coopname: string, fundId: number): Promise<FundContract.Tables.Funds.IFund> {
    const rows = await this.registry.listFunds(coopname);
    const row = rows.find((r) => Number(r.id) === fundId);
    if (!row) throw DomainError.notFound('REPORTS_FUND_NOT_FOUND', { fundId });
    return row;
  }

  private async fundView(
    input: ReportsFundsInputDTO,
    row: FundContract.Tables.Funds.IFund,
    availableOf: Map<string, string>,
    symbol: string
  ): Promise<ReportsFundDTO> {
    const wallet = String(row.wallet);
    const turnover = await this.turnover(input, wallet, symbol);
    return {
      id: Number(row.id),
      kind: String(row.kind) === FundContract.Tables.Funds.KIND_ACCUMULATION ? ReportsFundKind.ACCUMULATION : ReportsFundKind.EXPENDITURE,
      name: row.name,
      description: row.description,
      percent: Number(row.percent) / PERCENT_UNITS,
      wallet,
      wallet_name: Ledger2.getWalletHumanName(wallet) ?? wallet,
      account: Ledger2.getWalletAccount(wallet),
      available: availableOf.get(wallet) ?? this.zero(symbol),
      income: turnover.income,
      outcome: turnover.outcome,
    };
  }

  /** Справка о вложениях «Благороста»: пул расходов программы на счёте 08, не фонд. */
  private async investmentsView(
    input: ReportsFundsInputDTO,
    availableOf: Map<string, string>,
    symbol: string
  ): Promise<ReportsFundDTO | null> {
    if (!this.operationsOfWallet(INVESTMENTS_WALLET).length) return null;
    const turnover = await this.turnover(input, INVESTMENTS_WALLET, symbol);
    return {
      id: INVESTMENTS_ID,
      kind: ReportsFundKind.EXPENDITURE,
      name: Ledger2.getWalletHumanName(INVESTMENTS_WALLET) ?? INVESTMENTS_WALLET,
      description: '',
      percent: 0,
      wallet: INVESTMENTS_WALLET,
      wallet_name: Ledger2.getWalletHumanName(INVESTMENTS_WALLET) ?? INVESTMENTS_WALLET,
      account: INVESTMENTS_ACCOUNT,
      available: availableOf.get(INVESTMENTS_WALLET) ?? this.zero(symbol),
      income: turnover.income,
      outcome: turnover.outcome,
    };
  }

  /** Операции реестра, у которых кошелёк стоит источником или получателем, без транзита. */
  private operationsOfWallet(wallet: string): WalletOperation[] {
    const out: WalletOperation[] = [];
    for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
      if (TRANSIT_CODES.has(op.code)) continue;
      if (op.wallet_to === wallet) {
        out.push({ code: op.code, direction: ReportsFundMovementDirection.IN, counterparty: op.wallet_from ?? null });
      } else if (op.wallet_from === wallet) {
        out.push({ code: op.code, direction: ReportsFundMovementDirection.OUT, counterparty: op.wallet_to ?? null });
      }
    }
    return out;
  }

  /** Обороты кошелька за период: поступления и списания по операциям учётной книги. */
  private async turnover(
    input: ReportsFundsInputDTO,
    wallet: string,
    symbol: string
  ): Promise<{ income: string; outcome: string }> {
    const operations = this.operationsOfWallet(wallet);
    const acc: Turnover = { income: 0n, outcome: 0n, precision: 4, symbol, seen: false };
    if (operations.length) {
      const byCode = new Map(operations.map((o) => [o.code, o.direction]));
      // Страницы истории читаются до конца: оборот — сумма всех операций периода.
      for (let page = 1; page <= TURNOVER_MAX_PAGES; page++) {
        const resp = await this.ledger.getHistory({
          coopname: input.coopname,
          actionNames: ['apply'],
          operationCodes: operations.map((o) => o.code),
          dateFrom: input.date_from,
          dateTo: input.date_to,
          page,
          limit: TURNOVER_PAGE,
          sortOrder: 'ASC',
        });
        for (const op of resp.items) addToTurnover(acc, op, byCode);
        if (page >= resp.totalPages) break;
      }
    }
    return {
      income: formatMoney(acc.income, acc.symbol, acc.precision),
      outcome: formatMoney(acc.outcome, acc.symbol, acc.precision),
    };
  }

  private movementView(op: InnerLedger2Operation, byCode: Map<string, WalletOperation>): ReportsFundMovementDTO | null {
    const meta = byCode.get(op.operationCode ?? '');
    const money = parseMoney(op.quantity);
    if (!meta || !money) return null;
    const signed = meta.direction === ReportsFundMovementDirection.OUT ? -money.units : money.units;
    return {
      global_sequence: String(op.globalSequence),
      block_num: op.blockNum,
      created_at: op.createdAt,
      operation_code: meta.code,
      operation_name: Ledger2.getOperationHumanName(meta.code) ?? meta.code,
      direction: meta.direction,
      amount: formatMoney(signed, money.symbol, money.precision),
      counterparty_wallet: meta.counterparty,
      counterparty_name: counterpartyName(meta.counterparty),
      process_hash: op.processHash ?? null,
      process_type: Ledger2.getOperationProcessType(meta.code) ?? null,
      username: op.username ?? null,
      memo: op.memo ?? null,
    };
  }

  /** Символ валюты по любому остатку кошелька; без остатков — валюта кооператива не известна, пусто. */
  private symbolOf(quantities: string[]): string {
    for (const q of quantities) {
      const money = parseMoney(q);
      if (money?.symbol) return money.symbol;
    }
    return '';
  }

  private zero(symbol: string): string {
    return formatMoney(0n, symbol, 4);
  }
}
