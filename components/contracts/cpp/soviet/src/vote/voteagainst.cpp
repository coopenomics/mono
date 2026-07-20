void add_vote_against(eosio::name coopname, eosio::name username, uint64_t decision_id) {
  // Инициализация таблицы решений
  decisions_index decisions(_soviet, coopname.value);

  // Поиск решения по decision_id
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Решение с данным ID не найдено.");
  
  // Модифицируем запись в таблице
  decisions.modify(decision, _soviet, [&](auto& row) {
    row.votes_against.push_back(username); // Добавляем участника в голоса против
  });
}

/**
 * @brief Голосование против решения совета
 * Позволяет члену совета голосовать против конкретного решения.
 * Проверяет права голоса и предотвращает повторное голосование.
 * @param version Версия протокола
 * @param coopname Наименование кооператива
 * @param username Наименование члена совета, голосующего против решения
 * @param decision_id Идентификатор решения для голосования
 * @param signed_at Время подписи
 * @param signed_hash Подписанный хеш
 * @param signature Подпись
 * @param public_key Публичный ключ
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p username или @p coopname
 */
void soviet::voteagainst(
  std::string version,
  eosio::name coopname, 
  eosio::name username, 
  uint64_t decision_id,
  eosio::time_point_sec signed_at,
  checksum256 signed_hash,
  eosio::signature signature,
  eosio::public_key public_key
) { 
  eosio::check(version == "1.0.0", "Неверная версия");
  if (!has_auth(username)) {
    require_auth(coopname);
  } else {
    require_auth(username);
  }
  
  // // Проверка соответствия ID решения
  // eosio::check(signed_at <= eosio::current_time_point(), "Время подписи не может быть в будущем");
  
  // Проверка подписи
  assert_recover_key(signed_hash, signature, public_key);
  
  // Ищем решение по ID
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ с указанным ID не найден");

  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_voting_member(username), "У вас нет права голоса");
  
  decision -> check_for_any_vote_exist(username);

  // Голос «против» только фиксируется. Отрицательный консенсус НЕ затирает
  // решение автоматически: отказ при достигнутом большинстве «против» проводит
  // председатель явным действием declinedec (развязано с авто-отменой по сроку
  // cancelexprd). Так принятое отрицательно решение не исчезает само из повестки.
  add_vote_against(coopname, username, decision->id);
};

