/**
 * @brief Подпись договора о полной материальной ответственности председателем кооперативного участка.
 * Председатель участка подписывает договор после решения совета об учреждении участка. Договор
 * бессрочный. Договор направляется председателю совета на встречную подпись через одобрения;
 * после неё apprliab фиксирует документ в реестре.
 * @param coopname Наименование кооператива
 * @param braname Кооперативный участок
 * @param username Председатель участка
 * @param liability Договор о полной материальной ответственности, подписанный председателем участка
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::signliab(eosio::name coopname, eosio::name braname, eosio::name username, document2 liability) {
  check_auth_or_fail(_branch, coopname, coopname, "signliab"_n);

  verify_document_or_fail(liability);
  Document::validate_registry_id(liability, 328);
  verify_signer_keys_or_fail(liability, username);

  auto br = get_branch_or_fail(coopname, braname);
  eosio::check(br.trustee == username, "Договор подписывает председатель кооперативного участка");

  // Якорь одобрения — хэш самого договора: повторная подпись после отказа получает свой.
  ::Soviet::create_approval(
    _branch,
    coopname,
    username,
    liability,
    "branchliab"_n,
    liability.hash,
    _branch,
    "apprliab"_n,
    "declliab"_n,
    std::string(""));
}
