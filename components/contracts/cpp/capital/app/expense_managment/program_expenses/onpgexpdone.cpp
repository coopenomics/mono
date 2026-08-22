/**
 * @brief Callback от шасси expense на финализацию program-расхода.
 *
 * Шасси expense шлёт его inline (authority — _expense@active) когда закончило
 * flow (closeexp или declexp). capital не делает ledger2-проводок —
 * они уже сделаны шасси на payexp/reportexp/returnexp/overspendexp. capital
 * только обновляет @c program_expense_pool и удаляет запись из @c progexpenses.
 *
 *   status == ExpenseDomain::ProposalStatus::CLOSED (4):
 *     total_actual <= reserved → consume(total_actual) + release(остаток);
 *     total_actual >  reserved (был overspendexp) → consume(reserved) +
 *       прямое списание превышения из program_expense_pool.
 *   status == ExpenseDomain::ProposalStatus::DECLINED (5):
 *     release(reserved); decline возможен только до оплат (total_actual == 0).
 *
 * @param coopname     Кооператив
 * @param expense_hash Хеш расхода (ключ в progexpenses)
 * @param status       ExpenseDomain::ProposalStatus
 * @param total_actual Фактически потраченная сумма
 * @param data         Произвольный payload от инициатора (не используется на MVP)
 *
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p _expense — inline-callback шасси.
 */
void capital::onpgexpdone(name coopname, checksum256 expense_hash, uint8_t status,
                          eosio::asset total_actual, std::vector<char> data) {
  require_auth(_expense);

  auto pgexp = Capital::Expenses::get_program_expense_or_fail(coopname, expense_hash);
  const auto reserved = pgexp.amount;

  if (status == static_cast<uint8_t>(ExpenseDomain::ProposalStatus::CLOSED)) {
    eosio::check(total_actual.symbol == reserved.symbol,
                 "Символ total_actual не совпадает с зарезервированной суммой");
    eosio::check(total_actual.amount >= 0,
                 "total_actual не может быть отрицательным");

    if (total_actual.amount <= reserved.amount) {
      if (total_actual.amount > 0) {
        Capital::State::consume_program_expense(coopname, total_actual);
      }
      const asset leftover = reserved - total_actual;
      if (leftover.amount > 0) {
        Capital::State::release_program_expense(coopname, leftover);
      }
    } else {
      // Перерасход (overspendexp в шасси): резерв списываем полностью,
      // превышение — напрямую из свободного пула программных расходов.
      Capital::State::consume_program_expense(coopname, reserved);
      const asset excess = total_actual - reserved;
      Capital::State::spend_program_expense_pool(coopname, excess);
    }
  } else if (status == static_cast<uint8_t>(ExpenseDomain::ProposalStatus::DECLINED)) {
    // Шасси отклоняет СЗ только до первой оплаты — резерв возвращается целиком.
    eosio::check(total_actual.amount == 0,
                 "DECLINED с ненулевым total_actual — нарушение инварианта шасси");
    Capital::State::release_program_expense(coopname, reserved);
  } else {
    eosio::check(false, "onpgexpdone принимает только статусы CLOSED либо DECLINED");
  }

  Capital::Expenses::delete_program_expense(coopname, pgexp.id);
}
