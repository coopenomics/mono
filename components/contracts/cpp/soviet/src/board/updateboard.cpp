/**
 * @brief Обновление совета или комиссии
 * Обновляет состав и параметры существующего совета кооператива.
 * Позволяет изменить список членов, название и описание совета.
 * @param coopname Наименование кооператива
 * @param username Наименование председателя кооператива
 * @param board_id Идентификатор совета для обновления
 * @param members Список членов совета
 * @param name Название совета
 * @param description Описание совета
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p username
 */
void soviet::updateboard(eosio::name coopname, eosio::name username, uint64_t board_id, std::vector<board_member> members, std::string name, std::string description){
  require_recipient(coopname);
  
  check_auth_or_fail(_soviet, coopname, username, "updateboard"_n);
  
  cooperatives2_index coops(_registrator, _registrator.value);
  auto org = coops.find(coopname.value);
  eosio::check(org != coops.end(), "Организация не найдена");
  eosio::check(org -> is_coop(), "Организация - не кооператив");

  boards_index boards(_soviet, coopname.value);
  auto board = boards.find(board_id);
  eosio::check(board != boards.end(), "Доска не найдена");

  participants_index participants(_soviet, coopname.value);

  if (board -> type == "soviet"_n) {
    bool has_chairman = false;
    std::set<eosio::name> usernames;
    eosio::name chairman;
    
    bool chairman_found = false;

    for (const auto& m : members) {
        auto participant = participants.find(m.username.value);
        eosio::check(participant != participants.end(), "Один из аккаунтов не найден в реестре пайщиков");
        eosio::check(participant -> type.value() == "individual"_n, "Только физическое лицо может быть членом Совета");

        eosio::check(usernames.insert(m.username).second, "Обнаружено повторение username");

        if (m.position == "chairman"_n) {
            eosio::check(!chairman_found, "Обнаружено более одного председателя");
            has_chairman = true;
            chairman = m.username;
            chairman_found = true;
        }
    }
    eosio::check(has_chairman, "Председатель кооператива должен быть указан в членах совета");
  };

  boards.modify(board, RamPayer::of(boards, coopname), [&](auto &b) {
    b.members = members;
    b.name = name;
    b.description = description;
    b.last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });
}
