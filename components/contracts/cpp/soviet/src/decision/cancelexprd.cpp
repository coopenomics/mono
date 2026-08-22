/**
 * @brief Отмена истекшего решения
 * Отменяет решение совета по истечении срока его действия.
 * Отправляет обратный вызов об отклонении и удаляет решение из системы.
 * @param coopname Наименование кооператива
 * @param decision_id Идентификатор решения для отмены
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
// Общая ветка отказа решения: при наличии полей коллбэка отправляет инициатору
// коллбэк отклонения, затем удаляет решение из оперативной таблицы. Вызывается
// из cancelexprd (просрочка) и voteagainst (отрицательный консенсус).
void decline_and_erase_decision(eosio::name coopname, uint64_t decision_id, const std::string &reason) {
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Решение не найдено");

  // Проверка наличия всех необходимых полей для отправки коллбэка
  if (decision->callback_contract.has_value() &&
      decision->decline_callback.has_value() &&
      decision->hash.has_value() &&
      decision->callback_contract.value() != ""_n &&
      decision->confirm_callback.value() != ""_n &&
      decision->decline_callback.value() != ""_n
    ) {

    // Отправка коллбэка отклонения
    Action::send<decline_callback_interface>(
      decision->callback_contract.value(),
      //TODO: delete it
      decision->decline_callback.value() == "declagm"_n ? "declmeet"_n : decision->decline_callback.value(),
      _soviet,
      coopname,
      decision->hash.value(),
      reason
    );
  }

  // Удаление решения
  decisions.erase(decision);
}

void soviet::cancelexprd(eosio::name coopname, uint64_t decision_id) {
  require_auth(coopname);

  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Решение не найдено");

  // Проверка истечения срока
  bool expired = true;
  if ( decision -> expired_at.has_value() ) {
    expired = (eosio::time_point_sec(eosio::current_time_point()) > decision->expired_at.value());
  }

  eosio::check(expired, "Срок действия решения ещё не истёк");

  decline_and_erase_decision(coopname, decision_id, std::string("Отклонение по истечению срока"));
}

/**
 * @brief Явное отклонение решения советом по отрицательному консенсусу
 * Проводится председателем (ключом кооператива), когда против решения
 * проголосовало большинство состава совета, до истечения срока. Развязано с
 * cancelexprd: просрочка гасится автоматически по сроку, а отрицательно принятое
 * решение снимается с повестки только этим явным действием.
 * @param coopname Наименование кооператива
 * @param decision_id Идентификатор решения для отклонения
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void soviet::declinedec(eosio::name coopname, uint64_t decision_id) {
  require_auth(coopname);

  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Решение не найдено");

  // Отрицательный консенсус: против должно высказаться больше половины состава
  // совета (порог зеркален votefor — 50%, строгое «больше»).
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto [votes_for_count, votes_against_count] = decision->get_votes_count();
  uint64_t total_members = board.get_members_count();
  uint64_t consensus_percent = 50;

  eosio::check(votes_against_count * 100 > total_members * consensus_percent,
    "Решение не отклонено советом: нет большинства голосов против");

  decline_and_erase_decision(coopname, decision_id, std::string("Отклонено советом: большинство голосов против"));
}