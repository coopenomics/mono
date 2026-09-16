void add_vote_for(eosio::name coopname, eosio::name username, uint64_t decision_id, bool approved) {
  // Инициализация таблицы решений
  decisions_index decisions(_soviet, coopname.value);

  // Поиск решения по decision_id
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Решение с данным ID не найдено.");

  // Модифицируем запись в таблице
  decisions.modify(decision, _soviet, [&](auto& row) {
    row.votes_for.push_back(username); // Добавляем участника в голоса за
    row.approved = approved;
  });
}

/**
 * @brief Голосование за решение совета
 *
 * Член совета голосует «за» по конкретному решению. Подпись голоса ставится над хэшем,
 * привязанным к этому голосу (см. Automation::vote_digest), а ключ подписи обязан
 * принадлежать указанному разрешению аккаунта члена совета: active — ручной голос,
 * иное разрешение — голос робота по включённой автоматизации. Транзакцию подаёт либо
 * сам член совета, либо кооператив (робот).
 * После голосования рассчитывается, превысило ли количество голосов «за» порог консенсуса.
 *
 * @param version Версия протокола подписи голоса
 * @param coopname Наименование кооператива
 * @param username Наименование члена совета, голосующего за решение
 * @param decision_id Идентификатор решения для голосования
 * @param signed_at Время подписи
 * @param signed_hash Подписанный хэш (привязан к действию, кооперативу, решению и времени)
 * @param signature Подпись
 * @param public_key Публичный ключ подписи
 * @param permission Разрешение аккаунта члена совета, которому принадлежит ключ подписи
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p username или @p coopname
 */
void soviet::votefor(
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
  if (!has_auth(username)) {
    require_auth(coopname);
  } else {
    require_auth(username);
  }
  eosio::check(version == "1.0.0", "Неверная версия");

  // Ищем решение по ID
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ с указанным ID не найден");
  
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_voting_member(username), "У вас нет права голоса");
  
  decision->check_for_any_vote_exist(username); 

  // Хэш голоса привязан к действию, кооперативу, решению и времени подписи:
  // подпись нельзя переиспользовать для другого решения или голоса «против».
  eosio::check(signed_hash == Automation::vote_digest("votefor"_n, coopname, decision_id, signed_at),
               "Подписанный хэш не соответствует голосу за это решение");

  // Ключ подписи принадлежит разрешению аккаунта члена совета; для разрешения робота —
  // ещё и включена автоматизация по типу решения.
  Automation::verify_member_signature(coopname, username, permission, decision->type, Automation::Kind::vote,
                                      signed_hash, signature, public_key);

  auto [votes_for_count, votes_against_count] = decision->get_votes_count();

  votes_for_count++;

  uint64_t total_members = board.get_members_count();
  uint64_t consensus_percent = 50;
  
  // Рассчитываем, больше ли количество голосов "за" заданного процента консенсуса от общего количества участников
  bool approved = votes_for_count * 100 > total_members * consensus_percent;

  add_vote_for(coopname, username, decision->id, approved);
};
