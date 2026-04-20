/**
 * Счёт плана ledger2 (таблица `ledger2::accounts` в блокчейне).
 *
 * ID — numeric с ×1000 offset: 51 (Р/С) → 51000, 80 (Пай) → 80000,
 * 86 (Целевые) → 86000. Субсчета не хранятся отдельной строкой — все
 * суммы агрегируются на родительском id (см. Epic 1 Story 1.12).
 *
 * account_type (синхронно с `AccountType` в `lib/core/ledger2/accounts.hpp`):
 *   0 — ACTIVE (дебетовый, «имущественный»): 04 НМА, 08 Вложения во
 *       внеоборотные активы, 51 Расчётный счёт, 58 Финансовые вложения.
 *       balance = debit_balance − credit_balance.
 *   1 — PASSIVE (кредитовый, «источник средств»): 80 Паевой фонд,
 *       86 Целевое финансирование. balance = credit_balance − debit_balance.
 *   2 — ACTIVE_PASSIVE (знаковое сальдо): счёт может оказаться и в активе,
 *       и в пассиве в зависимости от состояния расчётов. balance =
 *       debit_balance − credit_balance (> 0 → чистый актив, < 0 →
 *       чистый пассив). В MVP после удаления 99 не используется — сохранён
 *       как значение enum на будущее.
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
