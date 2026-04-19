/**
 * Счёт плана ledger2 (таблица `ledger2::accounts` в блокчейне).
 *
 * ID — numeric с ×1000 offset: 51 (Р/С) → 51000, 80 (Пай) → 80000,
 * 86 (Целевые) → 86000. Субсчета не хранятся отдельной строкой — все
 * суммы агрегируются на родительском id (см. Epic 1 Story 1.12).
 *
 * account_type:
 *   0 — active (дебетовый, «имущественный»): 51, 04, 1 (материалы) и т.д.
 *   1 — passive (кредитовый, «источник средств»): 80 Пай, 86 Целевое
 *       финансирование, 60/76 обязательства и т.д.
 *
 * Суммы в формате `"7000.0000 RUB"` (EOSIO asset) — парсится через
 * существующий `parseAmount` в report.resolver.
 */
export interface Ledger2AccountDomainInterface {
  id: number;
  name: string;
  balance: string;
  debitBalance: string;
  creditBalance: string;
  accountType: number;
}
