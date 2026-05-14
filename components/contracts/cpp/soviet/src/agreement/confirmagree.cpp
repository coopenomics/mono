/**
 * @brief Подтверждение соглашения участником
 * Подтверждает соглашение участником целевой программы кооператива.
 * Изменяет статус соглашения на "подтверждено" после проверки соответствия пользователя.
 * @param coopname Наименование кооператива
 * @param administrator Наименование администратора
 * @param username Наименование пользователя, подтверждающего соглашение
 * @param agreement_id Идентификатор соглашения для подтверждения
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p administrator
 */
[[eosio::action]] void soviet::confirmagree(eosio::name coopname, eosio::name administrator, eosio::name username, uint64_t agreement_id) {
  check_auth_or_fail(_soviet, coopname, administrator, "confirmagree"_n);
  
  
  agreements2_index agreements(_soviet, coopname.value);
  auto indoc = agreements.find(agreement_id);
  eosio::check(indoc != agreements.end(), "Документ не найден");

  // После Эпика 2: программные соглашения переехали в wallet::users —
  // подтверждать/отклонять их в soviet больше нельзя.
  eosio::check(indoc->program_id == 0,
               "soviet::confirmagree: программные соглашения (program_id > 0) подтверждаются через wallet::signagree");

  bool is = is_participant_of_cpp_by_program_id(coopname, username, indoc -> program_id);
  eosio::check(!is, "Участник уже принимает участие данной целевой программы");
  eosio::check(indoc -> username == username, "Имя пользователя не соответствует документу");
  
  agreements.modify(indoc, administrator, [&](auto &d) { 
    d.status = "confirmed"_n;
  });
  
  // action(
  //   permission_level{ _soviet, "active"_n},
  //   _soviet,
  //   "newresolved"_n,
  //   std::make_tuple(coopname, username, indoc -> type, 0, indoc -> document)
  // ).send();
  
}