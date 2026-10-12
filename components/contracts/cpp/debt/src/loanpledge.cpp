/**
 * @brief Договор залога имущественного права с подписью пайщика.
 *
 * Идёт одной транзакцией с заявлением (createloan): залог права на возврат
 * части паевого взноса оформляется отдельным договором, и совет видит его в
 * пакете заявления. Без договора залога совет выдачу не разрешит.
 *
 * @param coopname Наименование кооператива
 * @param username Пайщик-заёмщик
 * @param debt_hash Хэш займа
 * @param pledge_contract Договор залога с подписью пайщика
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::loanpledge(eosio::name coopname, eosio::name username, checksum256 debt_hash, document2 pledge_contract) {
  require_auth(coopname);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.username == username, "Заём принадлежит другому пайщику");
  eosio::check(d.status == Debt::Status::CREATED, "Договор залога прикладывается к поданному заявлению");
  eosio::check(!Debt::Core::has_doc(d.pledge_contract), "Договор залога уже приложен");
  eosio::check(!is_empty_document(pledge_contract), "Нужен договор залога с подписью пайщика");
  verify_document_or_fail(pledge_contract, {username});
  verify_signer_keys_or_fail(pledge_contract, username);

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) { row.pledge_contract.emplace(pledge_contract); });
  Debt::Core::link_document(coopname, username, debt_hash, pledge_contract);

  require_recipient(username);
  require_recipient(coopname);
}
