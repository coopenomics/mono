import { TokenContract } from 'cooptypes';

/**
 * Событие узла-хаба: остаток AXON кооператива в цепи изменился (28.11.2026).
 *
 * Бак AXON кооператив расходует на аренду ресурсов цепи. Хаб пополняет бак
 * квантом, когда остаток ниже порога; раньше он узнавал об этом только плановой
 * проверкой раз в пять минут, и кооператив с пустым баком всё это время стоял.
 * Событие объявляет разбор цепи по дельте таблицы остатков токена.
 */
export const BILLING_TANK_BALANCE_EVENT = 'billing::tank::balance';

export interface BillingTankBalancePayload {
  /** Аккаунт, чей остаток изменился. Кооператив ли это, решает слушатель. */
  coopname: string;
  /** Остаток AXON после изменения; строка остатка стёрта — ноль. */
  balance: number;
}

/** Поля дельты цепи, по которым читается остаток токена. */
export interface TokenBalanceDelta {
  code: string;
  table: string;
  scope: string;
  present: boolean;
  value?: unknown;
}

/**
 * Остаток AXON из дельты таблицы остатков токена (`eosio.token::accounts`,
 * область — аккаунт). Другая таблица или другой токен — `null`. Стёртая строка
 * означает нулевой остаток.
 */
export function tankBalanceOf(delta: TokenBalanceDelta, axonSymbol: string): BillingTankBalancePayload | null {
  if (delta.code !== TokenContract.contractName.production) return null;
  if (delta.table !== TokenContract.Tables.AccountBalance.tableName) return null;
  const raw = String((delta.value as { balance?: unknown } | undefined)?.balance ?? '');
  if (!raw.endsWith(` ${axonSymbol}`)) return null;
  const balance = delta.present === false ? 0 : Number.parseFloat(raw);
  return Number.isFinite(balance) ? { coopname: delta.scope, balance } : null;
}
