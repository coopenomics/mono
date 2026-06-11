/**
 * @brief Отмена собрания инициатором до вывода на совет.
 * Инициатор сворачивает собрание, пока решение не ушло в совет; запись и вопросы
 * повестки стираются, причина передаётся аргументом (история — в журнале действий).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param reason Причина отмены
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::canceldec(eosio::name coopname, eosio::checksum256 hash, std::string reason) {
  check_auth_or_fail(_branch, coopname, coopname, "canceldec"_n);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status != "onapproval"_n, "Решение уже на рассмотрении совета — отмена недоступна");

  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  erase_coodecquests(coopname, dec.id);
  decisions.erase(itr);
}
