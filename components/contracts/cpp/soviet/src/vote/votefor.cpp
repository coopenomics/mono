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
\ingroup public_actions
\brief Голосование за решение совета
*
* Этот метод позволяет члену совета голосовать за конкретное решение. Если у члена совета нет права голоса или голосование уже было произведено ранее, процедура завершится ошибкой. После голосования рассчитывается, превысило ли количество голосов "за" заданный процент консенсуса от общего количества членов.
*
* @param coopname Имя кооператива
* @param username Имя члена совета, голосующего за решение
* @param decision_hash Хэш решения, за которое происходит голосование
* @param signed_at Время подписи
* @param signed_hash Подписанный хэш
* @param signature Подпись
* @param public_key Публичный ключ
* 
* @note Авторизация требуется от аккаунта: @p username или @p permission_level{username, "oracle"_n}
*/
void soviet::votefor(
  std::string version,
  eosio::name coopname, 
  eosio::name username, 
  uint64_t decision_id,
  eosio::time_point_sec signed_at,
  checksum256 signed_hash,
  eosio::signature signature,
  eosio::public_key public_key
) { 
  if (!has_auth(username)) {
    require_auth(coopname);
  } else {
    require_auth(username);
  }
  eosio::check(version == "1.0.0", "Неверная версия");
  
  // Проверка соответствия ID решения
  // eosio::check(signed_at <= eosio::current_time_point(), "Время подписи не может быть в будущем");
  
  // Проверка подписи
  assert_recover_key(signed_hash, signature, public_key);
  
  // Ищем решение по ID
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ с указанным ID не найден");
  
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_voting_member(username), "У вас нет права голоса");
  
  decision->check_for_any_vote_exist(username); 

  auto [votes_for_count, votes_against_count] = decision->get_votes_count();

  votes_for_count++;

  uint64_t total_members = board.get_members_count();
  uint64_t consensus_percent = 50;
  
  // Рассчитываем, больше ли количество голосов "за" заданного процента консенсуса от общего количества участников
  bool approved = votes_for_count * 100 > total_members * consensus_percent;

  add_vote_for(coopname, username, decision->id, approved);
};

