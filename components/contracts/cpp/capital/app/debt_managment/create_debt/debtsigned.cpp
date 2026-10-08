/**
 * @brief Председатель подписал договор займа
 * Подписанный договор сохраняется, заём передаётся кассиру на выплату.
 * @param coopname Наименование кооператива
 * @param username Председатель, подтвердивший одобрение
 * @param debt_hash Хэш займа
 * @param signed_contract Договор займа с подписью председателя
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p _soviet
 */
void capital::debtsigned(name coopname, name username, checksum256 debt_hash, document2 signed_contract) {
  require_auth(_soviet);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  // username — председатель, подтвердивший одобрение: совет передаёт его имя, не имя заёмщика.
  eosio::check(exist_debt.status == Capital::Debts::Status::AUTHORIZED, "Договор подписывается после решения совета");
  eosio::check(!is_empty_document(signed_contract), "Нужен договор с подписью председателя");
  eosio::check(signed_contract.hash == exist_debt.contract.hash,
               "Председатель подписывает тот же договор, что подписал пайщик");

  Capital::Debts::update_debt_status(coopname, exist_debt.id, Capital::Debts::Status::PAYING, _soviet, signed_contract);
  Capital::Debts::create_debt_outcome(coopname, exist_debt);
}
