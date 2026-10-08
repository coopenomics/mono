/**
 * @brief Договор займа к заявлению пайщика
 * Пайщик подписывает заявление и договор займа под обеспечение имуществом на
 * ответственном хранении; оба документа уходят в цепь одной транзакцией
 * (createdebt + debtcontract). С договором заявление становится повесткой совета.
 * @param coopname Наименование кооператива
 * @param username Пайщик-заёмщик
 * @param debt_hash Хэш займа
 * @param contract Договор займа с подписью пайщика
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::debtcontract(name coopname, name username, checksum256 debt_hash, document2 contract) {
  require_auth(coopname);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  eosio::check(exist_debt.username == username, "Заём принадлежит другому пайщику");
  eosio::check(exist_debt.status == Capital::Debts::Status::CREATED, "Договор уже приложен к заявлению");
  eosio::check(!is_empty_document(contract), "Нужен договор займа с подписью пайщика");

  verify_document_or_fail(contract, {username});
  verify_signer_keys_or_fail(contract, username);

  Capital::Debts::update_debt_status(coopname, exist_debt.id, Capital::Debts::Status::PENDING, coopname, contract);
  Capital::Debts::create_debt_agenda(coopname, username, debt_hash, exist_debt.statement);
}
