/**
 * @brief Назначение председателя собрания.
 * Инициатор назначает председателя из числа присоединившихся участников.
 * Для решения типа "createbranch" председатель собрания становится кандидатом
 * в председатели кооперативного участка.
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param chairman Имя назначаемого председателя (из участников)
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::setchair(eosio::name coopname, eosio::checksum256 hash, eosio::name chairman) {
  check_auth_or_fail(_branch, coopname, coopname, "setchair"_n);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status == "opened"_n, "Председателя можно назначить только до начала голосования");
  eosio::check(dec.is_participant(chairman), "Председатель должен быть участником собрания");

  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  decisions.modify(itr, coopname, [&](auto &d) {
    d.chairman = chairman;
  });
}
