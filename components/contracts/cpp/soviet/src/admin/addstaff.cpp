
/**
 * @brief Добавление персонала кооператива
 * Добавляет нового члена персонала в кооператив с указанием определенных прав на выполнение методов действий вместо совета.
 * @param coopname Наименование кооператива
 * @param chairman Наименование председателя совета
 * @param username Наименование нового члена персонала
 * @param rights Список прав, разрешенных для выполнения указанным членом персонала
 * @param position_title Название должности нового члена персонала
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p chairman
 */
void soviet::addstaff(eosio::name coopname, eosio::name chairman, eosio::name username, std::vector<right> rights, std::string position_title) {
  require_auth(chairman);

  staff_index staff(_soviet, coopname.value);
  
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_valid_chairman(chairman), "Только председатель кооператива может добавлять персонал");

  auto persona = staff.find(username.value);
  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Сотрудник не найден в картотеке аккаунтов");

  eosio::check(persona == staff.end(), "Сотрудник уже добавлен. Отредактируйте его права или переназначьте на другую должность");

  staff.emplace(RamPayer::of(staff, coopname), [&](auto &a){
    a.username = username;
    a.position_title = position_title;
    a.rights = rights;
    a.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    a.updated_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });

};
