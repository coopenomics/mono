/**
 * @brief Открытие голосования по решению.
 * Председатель собрания открывает голосование. Для решения "createbranch"
 * указывается адрес привязки кооперативного участка. Сроков ожидания нет —
 * окно голосования короткое.
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param address Адрес привязки кооперативного участка (для "createbranch")
 * @param open_at Начало окна голосования
 * @param close_at Плановое закрытие окна голосования
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::startdec(eosio::name coopname, eosio::checksum256 hash, std::string address, eosio::time_point_sec open_at, eosio::time_point_sec close_at) {
  check_auth_or_fail(_branch, coopname, coopname, "startdec"_n);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status == "opened"_n, "Голосование уже начато или собрание закрыто");
  eosio::check(close_at.sec_since_epoch() > open_at.sec_since_epoch(), "Дата закрытия должна быть после даты открытия");

  if (dec.type == "createbranch"_n) {
    eosio::check(!address.empty(), "Для создания кооперативного участка требуется адрес привязки");
  }

  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  decisions.modify(itr, coopname, [&](auto &d) {
    d.status = "voting"_n;
    d.address = address;
    d.open_at = open_at;
    d.close_at = close_at;
  });
}
