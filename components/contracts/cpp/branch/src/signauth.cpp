/**
 * @brief Подпись доверенности председателем кооперативного участка.
 * Председатель участка подписывает доверенность после решения совета об учреждении участка:
 * доверенность ссылается на протокол этого решения, срок доверенности — один год. Продление —
 * то же действие с новой доверенностью. Доверенность направляется председателю совета на
 * встречную подпись через одобрения; после неё apprauth фиксирует документ в реестре.
 * Номер, срок и состояние доверенности учитывает узел — цепь хранит только подписи.
 * @param coopname Наименование кооператива
 * @param braname Кооперативный участок
 * @param username Председатель участка
 * @param authority Доверенность председателю кооперативного участка, подписанная председателем участка
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::signauth(eosio::name coopname, eosio::name braname, eosio::name username, document2 authority) {
  check_auth_or_fail(_branch, coopname, coopname, "signauth"_n);

  verify_document_or_fail(authority);
  Document::validate_registry_id(authority, 329);
  verify_signer_keys_or_fail(authority, username);

  auto br = get_branch_or_fail(coopname, braname);
  eosio::check(br.trustee == username, "Доверенность подписывает председатель кооперативного участка");

  // Якорь одобрения — хэш самой доверенности: у каждой доверенности (первой и продлений) свой.
  ::Soviet::create_approval(
    _branch,
    coopname,
    username,
    authority,
    "branchauth"_n,
    authority.hash,
    _branch,
    "apprauth"_n,
    "declauth"_n,
    std::string(""));
}
