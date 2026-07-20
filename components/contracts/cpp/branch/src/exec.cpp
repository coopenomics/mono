/**
 * @brief Исполнение утверждённого решения о создании кооперативного участка.
 * Председатель собрания формирует заявление в совет и выводит вопрос об учреждении
 * кооперативного участка на рассмотрение совета. К повестке совета прилагаются
 * протокол собрания и бюллетени (по тому же якорю процесса).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param petition Подписанное заявление председателя в совет
 * @param liability Подписанный председателем участка договор о полной материальной ответственности
 * @param authority Подписанная председателем участка доверенность председателю кооперативного участка
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::exec(eosio::name coopname, eosio::checksum256 hash, document2 petition, document2 liability, document2 authority) {
  check_auth_or_fail(_branch, coopname, coopname, "exec"_n);

  verify_document_or_fail(petition);
  verify_document_or_fail(liability);
  verify_document_or_fail(authority);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.type == "createbranch"_n, "Исполнение доступно только для решения о создании участка");
  eosio::check(dec.status == "approved"_n, "Решение не утверждено председателем");

  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  decisions.modify(itr, coopname, [&](auto &d) {
    d.status = "onapproval"_n;
    d.petition = petition;
    d.liability = liability;
    d.authority = authority;
  });

  ::Soviet::create_agenda(
    _branch,
    coopname,
    dec.chairman,
    get_valid_soviet_action("branchdec"_n),
    hash,
    _branch,
    "confirmdec"_n,
    "declinedec"_n,
    petition,
    std::string(""));

  // К пакету повестки совета линкуются договор о материальной ответственности и доверенность
  // председателя участка — совет читает их вместе с заявлением до утверждения (по якорю процесса).
  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _branch,
    coopname,
    dec.chairman,
    get_valid_soviet_action("branchliab"_n),
    hash,
    liability
  );

  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _branch,
    coopname,
    dec.chairman,
    get_valid_soviet_action("branchauth"_n),
    hash,
    authority
  );
}
