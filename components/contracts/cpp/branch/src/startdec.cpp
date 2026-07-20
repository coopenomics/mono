/**
 * @brief Открытие голосования по решению.
 * Организатор собрания (он же председатель собрания) открывает голосование,
 * указывая избираемого председателя кооперативного участка (из числа
 * присоединившихся участников) и — для решения "createbranch" —
 * адрес привязки кооперативного участка, определённый собранием.
 * Окно голосования отмеряется автоматически (DECISION_VOTING_WINDOW_SECONDS).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param chairman Избираемый председатель кооперативного участка (из участников)
 * @param address Адрес привязки кооперативного участка (для "createbranch")
 * @param agenda Итоговая повестка собрания: если непуста — заменяет предварительную
 *        (уточнённые на собрании формулировки и дополнительные вопросы); пустая — повестка без изменений
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::startdec(eosio::name coopname, eosio::checksum256 hash, eosio::name chairman, std::string address, std::vector<decision_point> agenda) {
  check_auth_or_fail(_branch, coopname, coopname, "startdec"_n);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status == "opened"_n, "Голосование уже начато или собрание закрыто");
  eosio::check(dec.participants.size() >= MIN_DECISION_QUORUM,
               "Для открытия голосования требуется не менее 3 участников собрания");
  eosio::check(dec.is_participant(chairman), "Председатель участка должен быть участником собрания");

  if (dec.type == "createbranch"_n) {
    eosio::check(!address.empty(), "Для создания кооперативного участка требуется адрес привязки");
  }

  // Итоговая повестка собрания: непустой список заменяет предварительную
  // (формулировки уточняются на собрании — наименование участка, председатель, новые вопросы)
  coodecquest_index questions(_branch, coopname.value);
  uint64_t number = 0;
  if (!agenda.empty()) {
    erase_coodecquests(coopname, dec.id);
  }

  for (const auto &point : agenda) {
    eosio::check(!point.title.empty(), "Вопрос должен содержать заголовок");
    eosio::check(!point.decision.empty(), "Вопрос должен содержать проект решения");

    number++;
    eosio::check(number <= 10, "Не больше 10 вопросов на повестке собрания");

    questions.emplace(coopname, [&](auto &q) {
      q.id = get_global_id_in_scope(_branch, coopname, "decisionq"_n);
      q.decision_id = dec.id;
      q.number = number;
      q.coopname = coopname;
      q.title = point.title;
      q.decision = point.decision;
      q.context = point.context;
      q.counter_votes_for = 0;
      q.counter_votes_against = 0;
      q.counter_votes_abstained = 0;
    });
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
