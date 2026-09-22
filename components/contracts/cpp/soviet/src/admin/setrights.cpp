

/**
 * @brief Установка прав для персонала кооператива
 * Устанавливает конкретные права для члена персонала в кооперативе.
 * Позволяет изменить список разрешенных действий для указанного сотрудника.
 * @param coopname Наименование кооператива
 * @param chairman Наименование председателя совета
 * @param username Наименование члена персонала, для которого устанавливаются права
 * @param rights Вектор прав, которые будут установлены для указанного члена персонала
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p chairman
 */
void soviet::setrights(eosio::name coopname, eosio::name chairman, eosio::name username, std::vector<right> rights) {
  require_auth(chairman);

  staff_index staff(_soviet, coopname.value);
  boards_index boards(_soviet, coopname.value);

  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_valid_chairman(chairman), "Только председатель кооператива может устанавливать права персонала");

  auto persona = staff.find(username.value);
  eosio::check(persona != staff.end(), "Персона не найдена");

  staff.modify(persona, RamPayer::of(staff, coopname), [&](auto &a){
    a.rights = rights;
    a.updated_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });  
};