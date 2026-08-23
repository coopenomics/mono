/**
 * @brief Отклонение решения советом.
 * Callback совета: при отказе совета запись решения и вопросы повестки стираются,
 * причина передаётся аргументом (история — в журнале действий).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param reason Причина отклонения
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
[[eosio::action]] void branch::declinedec(eosio::name coopname, eosio::checksum256 hash, std::string reason) {
  require_auth(_soviet);

  decision_index decisions(_branch, coopname.value);
  auto idx = decisions.get_index<"byhash"_n>();
  auto itr = idx.find(hash);

  if (itr != idx.end()) {
    erase_coodecquests(coopname, itr->id);
    idx.erase(itr);
  }
}
