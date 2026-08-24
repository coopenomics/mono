/**
 * @brief Пайщик возвращает заём деньгами.
 *
 * Прямой возврат — без сдачи результата: сумма, равная остатку займа, закрывает
 * обязательство целиком. Частичный возврат не предусмотрен. В учёте это возврат
 * финансового вложения кооператива (Дт 80 / Кт 58).
 *
 * Второй путь закрытия — сдача результата: при подписании акта та же операция
 * возврата выполняется на сумму займа, зачтённого результатом (см. signact2).
 *
 * @param coopname   Наименование кооператива
 * @param debt_hash  Хеш возвращаемого займа
 * @param amount     Сумма возврата — должна совпасть с суммой займа
 * @param statement  Заявление пайщика о возврате займа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 */
void capital::settledebt(name coopname, checksum256 debt_hash, eosio::asset amount, document2 statement) {
  require_auth(coopname);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  eosio::check(exist_debt.status == Capital::Debts::Status::PAID
            || exist_debt.status == Capital::Debts::Status::OVERDUE,
               "Вернуть можно только выданный или просроченный заём");

  verify_document_or_fail(statement, {exist_debt.username});

  Wallet::validate_asset(amount);
  eosio::check(amount.symbol == exist_debt.amount.symbol,
               "Символ суммы возврата не совпадает с символом займа");
  eosio::check(amount == exist_debt.amount,
               "Сумма возврата должна полностью покрывать заём");

  auto contributor = Capital::Contributors::get_contributor(coopname, exist_debt.username);
  eosio::check(contributor.has_value(), "Контрибьютор не найден");

  auto memo = Capital::Memo::get_settle_debt_memo(exist_debt.username, debt_hash);
  Ledger2::apply(_capital, coopname, operations::capital::REPAY, processes::capital::RID,
                 amount, exist_debt.username, debt_hash, memo);

  Capital::Contributors::decrease_debt_amount(coopname, contributor->id, amount);
  Capital::Debts::mark_settled(coopname, exist_debt.id, memo, _capital);

  Capital::Segments::decrease_active_debts_count(coopname, exist_debt.project_hash, exist_debt.username);

  // Сводный учёт займов: запись закрывается и там.
  Loan::settle_debt(_capital, coopname, exist_debt.username, debt_hash, amount);

  // Пайщик и кооператив получают уведомление о возврате займа.
  require_recipient(exist_debt.username);
  require_recipient(coopname);
}
