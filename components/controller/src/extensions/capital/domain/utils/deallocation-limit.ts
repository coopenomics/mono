import { ProjectStatus } from '../enums/project-status.enum';
import { AssetUtils } from '@coopenomics/extension-kit';

/**
 * Статусы проекта, в которых контракт разрешает возврат средств.
 * С началом голосования суммы уже участвуют в расчёте результата, двигать их нельзя.
 */
const DEALLOCATABLE_STATUSES: ProjectStatus[] = [ProjectStatus.PENDING, ProjectStatus.ACTIVE];

/** Разрешает ли статус компонента возврат средств в программу. */
export function isDeallocatableStatus(status?: ProjectStatus): boolean {
  return status != null && DEALLOCATABLE_STATUSES.includes(status);
}

/** Слепок сегмента, нужный для расчёта границы по ссудам. */
export interface DeallocationSegmentSnapshot {
  creator_base?: string;
  author_base?: string;
  coordinator_base?: string;
  debt_amount?: string;
}

/** Пулы компонента, от которых считается предел возврата. */
export interface DeallocationProjectSnapshot {
  status?: ProjectStatus;
  creators_base_pool?: string;
  authors_base_pool?: string;
  coordinators_base_pool?: string;
  invest_pool?: string;
  program_invest_pool?: string;
  total_received_investments?: string;
  total_used_for_compensation?: string;
  used_expense_pool?: string;
}

export interface DeallocationLimit {
  max_amount: number;
  program_invest_pool: number;
  unspent: number;
  outstanding_debt: number;
  is_allowed_by_status: boolean;
  /** Символ ассета компонента — берётся из его же пулов, а не из конфигурации */
  symbol: string;
}

function amountOf(asset?: string): number {
  return AssetUtils.parseAsset(asset ?? '').amount || 0;
}

/** Символ берём из первого непустого пула компонента: все они в валюте кооператива. */
function symbolOf(project: DeallocationProjectSnapshot): string {
  for (const asset of [project.program_invest_pool, project.invest_pool, project.total_received_investments]) {
    const parsed = AssetUtils.parseAsset(asset ?? '');
    if (parsed.symbol) return parsed.symbol;
  }
  return '';
}

/**
 * Считает, сколько можно вернуть из компонента в программу.
 *
 * Повторяет расчёт контракта (`calculate_max_deallocatable` в capital) — здесь
 * он нужен, чтобы показать председателю предел до отправки транзакции.
 * Источник истины остаётся за контрактом: он проверит границу сам и откажет,
 * если данные разошлись.
 *
 * Три ограничения, берём минимум:
 *  1. возвращаются только средства программы — не больше направленных в компонент;
 *  2. нельзя вернуть израсходованное — выплаты участникам и оплаченные расходы;
 *  3. нельзя опустить инвестиционный пул ниже границы, при которой у заёмщика
 *     доступная сумма упадёт ниже его долга. Доступная сумма линейна по пулу
 *     (base_i * invest_pool / work_costs), поэтому граница —
 *     work_costs * max(debt_i / base_i).
 */
export function calculateDeallocationLimit(
  project: DeallocationProjectSnapshot,
  segments: DeallocationSegmentSnapshot[]
): DeallocationLimit {
  const isAllowedByStatus = isDeallocatableStatus(project.status);
  const symbol = symbolOf(project);

  const programPool = amountOf(project.program_invest_pool);
  const investPool = amountOf(project.invest_pool);

  const spent = amountOf(project.total_used_for_compensation) + amountOf(project.used_expense_pool);
  const unspent = Math.max(0, amountOf(project.total_received_investments) - spent);

  const outstandingDebt = segments.reduce((acc, segment) => acc + amountOf(segment.debt_amount), 0);

  const workCosts =
    amountOf(project.creators_base_pool) +
    amountOf(project.authors_base_pool) +
    amountOf(project.coordinators_base_pool);

  let minInvestPool = 0;
  if (workCosts > 0 && outstandingDebt > 0) {
    let maxRatio = 0;
    for (const segment of segments) {
      const debt = amountOf(segment.debt_amount);
      if (debt <= 0) continue;

      const base = amountOf(segment.creator_base) + amountOf(segment.author_base) + amountOf(segment.coordinator_base);
      // Долг без трудовой базы контракт не создаёт: доступная сумма такого
      // участника равна нулю при любом пуле, и возврат был бы невозможен вовсе.
      if (base <= 0) return zeroLimit(programPool, unspent, outstandingDebt, isAllowedByStatus, symbol);

      maxRatio = Math.max(maxRatio, debt / base);
    }
    minInvestPool = workCosts * maxRatio;
  }

  const byDebts = Math.max(0, investPool - minInvestPool);
  const maxAmount = isAllowedByStatus ? Math.max(0, Math.min(programPool, unspent, byDebts)) : 0;

  return {
    max_amount: maxAmount,
    program_invest_pool: programPool,
    unspent,
    outstanding_debt: outstandingDebt,
    is_allowed_by_status: isAllowedByStatus,
    symbol,
  };
}

function zeroLimit(
  programPool: number,
  unspent: number,
  outstandingDebt: number,
  isAllowedByStatus: boolean,
  symbol: string
): DeallocationLimit {
  return {
    max_amount: 0,
    program_invest_pool: programPool,
    unspent,
    outstanding_debt: outstandingDebt,
    is_allowed_by_status: isAllowedByStatus,
    symbol,
  };
}
