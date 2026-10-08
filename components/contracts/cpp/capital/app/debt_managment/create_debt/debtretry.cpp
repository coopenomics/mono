/**
 * @brief Повтор платежа по займу после отказа кассира
 * Заём с подписанным договором снова передаётся кассиру по тому же решению
 * совета.
 * @param coopname Наименование кооператива
 * @param debt_hash Хэш займа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::debtretry(name coopname, checksum256 debt_hash) {
  require_auth(coopname);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  eosio::check(exist_debt.status == Capital::Debts::Status::SIGNED, "Повторить платёж можно только после отказа кассира");

  Capital::Debts::update_debt_status(coopname, exist_debt.id, Capital::Debts::Status::PAYING, coopname);
  Capital::Debts::create_debt_outcome(coopname, exist_debt);
}
