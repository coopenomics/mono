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
 *
 * Член совета голосует «против». Подпись и ключ проверяются так же, как у голоса «за»:
 * хэш привязан к голосу «против» по этому решению, ключ принадлежит указанному
 * разрешению аккаунта. Робот против не голосует, но ограничения автоматизации
 * действуют и здесь: разрешение робота принимается только по делегированным типам.
 *
 * @param version Версия протокола подписи голоса
 * @param coopname Наименование кооператива
 * @param username Наименование члена совета
 * @param decision_id Идентификатор решения
 * @param signed_at Время подписи
 * @param signed_hash Подписанный хэш (привязан к действию, кооперативу, решению и времени)
 * @param signature Подпись
 * @param public_key Публичный ключ подписи
 * @param permission Разрешение аккаунта члена совета, которому принадлежит ключ подписи
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
  eosio::public_key public_key,
  eosio::name permission
) { 
  eosio::check(version == "1.0.0", "Неверная версия");
  if (!has_auth(username)) {
    require_auth(coopname);
  } else {
    require_auth(username);
  }
  
  // Ищем решение по ID
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ с указанным ID не найден");

  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_voting_member(username), "У вас нет права голоса");
  
  decision -> check_for_any_vote_exist(username);

  eosio::check(signed_hash == Automation::vote_digest("voteagainst"_n, coopname, decision_id, signed_at),
               "Подписанный хэш не соответствует голосу против этого решения");

  Automation::verify_member_signature(coopname, username, permission, decision->type, Automation::Kind::vote,
                                      signed_hash, signature, public_key);

  // Голос «против» только фиксируется. Отрицательный консенсус НЕ затирает
  // решение автоматически: отказ при достигнутом большинстве «против» проводит
  // председатель явным действием declinedec (развязано с авто-отменой по сроку
  // cancelexprd). Так принятое отрицательно решение не исчезает само из повестки.
  add_vote_against(coopname, username, decision->id);
};
