/**
 * @brief Открытие голосования по решению.
 * Организатор собрания открывает голосование, указывая председателя собрания
 * (из числа присоединившихся участников) и — для решения "createbranch" —
 * адрес привязки кооперативного участка, определённый собранием.
 * Окно голосования отмеряется автоматически (DECISION_VOTING_WINDOW_SECONDS).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param chairman Председатель собрания (из участников)
 * @param address Адрес привязки кооперативного участка (для "createbranch")
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::startdec(eosio::name coopname, eosio::checksum256 hash, eosio::name chairman, std::string address) {
  check_auth_or_fail(_branch, coopname, coopname, "startdec"_n);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status == "opened"_n, "Голосование уже начато или собрание закрыто");
  eosio::check(dec.is_participant(chairman), "Председатель должен быть участником собрания");

  if (dec.type == "createbranch"_n) {
    eosio::check(!address.empty(), "Для создания кооперативного участка требуется адрес привязки");
  }

  auto now = current_time_point();

  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  decisions.modify(itr, coopname, [&](auto &d) {
    d.status = "voting"_n;
    d.chairman = chairman;
    d.address = address;
    d.open_at = eosio::time_point_sec(now.sec_since_epoch());
    d.close_at = eosio::time_point_sec(now.sec_since_epoch() + DECISION_VOTING_WINDOW_SECONDS);
  });
}
