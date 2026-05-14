/**
 * @brief Отклонение соглашения участником
 * Отклоняет соглашение участником целевой программы кооператива.
 * Изменяет статус соглашения на "отклонено" и отправляет уведомление об отклонении.
 * @param coopname Наименование кооператива
 * @param administrator Наименование администратора
 * @param username Наименование пользователя, отклоняющего соглашение
 * @param agreement_id Идентификатор соглашения для отклонения
 * @param comment Комментарий к отклонению
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p administrator
 */
[[eosio::action]] void soviet::declineagree(eosio::name coopname, eosio::name administrator, eosio::name username, uint64_t agreement_id, std::string comment){
  check_auth_or_fail(_soviet, coopname, administrator, "declineagree"_n);
  
  agreements2_index agreements(_soviet, coopname.value);
  auto indoc = agreements.find(agreement_id);

  eosio::check(indoc != agreements.end(), "Документ не найден");
  eosio::check(indoc -> username == username, "Имя пользователя не соответствует документу");

  // После Эпика 2: программные соглашения (program_id > 0) живут в wallet::users —
  // отклоняются через wallet::revokeagree.
  eosio::check(indoc->program_id == 0,
               "soviet::declineagree: программные соглашения (program_id > 0) отклоняются через wallet::revokeagree");
  
  agreements.modify(indoc, administrator, [&](auto &d) { 
    d.status = "declined"_n;
  });
  
  checksum256 hash = checksum256();
  
  Action::send<newdeclined_interface>(
    _soviet,
    "newdeclined"_n,
    _soviet,
    coopname,
    username,
    checksum256(),
    indoc -> document
  );
}