/**
 * @brief Отклонение заявки доверенного лица председателем участка.
 * Заявка стирается, причина передаётся аргументом (история — в журнале действий).
 * @param coopname Наименование кооператива
 * @param hash Внешний идентификатор заявки
 * @param reason Причина отклонения
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::decltrusted(eosio::name coopname, eosio::checksum256 hash, std::string reason) {
  check_auth_or_fail(_branch, coopname, coopname, "decltrusted"_n);

  auto req = get_trustreq_or_fail(coopname, hash);

  trustreq_index trustreqs(_branch, coopname.value);
  auto ritr = trustreqs.find(req.id);
  trustreqs.erase(ritr);
}
