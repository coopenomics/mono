/**
 * @brief Создание решения о выводе средств
 * Создает решение совета о выводе средств участника из кооператива.
 * Инициирует процесс голосования по выводу средств.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя
 * @param withdraw_id Идентификатор вывода средств
 * @param statement Документ с описанием вывода средств
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _gateway
 */
void soviet::withdraw(eosio::name coopname, eosio::name username, uint64_t withdraw_id, document2 statement) { 

  require_auth(_gateway);

  auto cooperative = get_cooperative_or_fail(coopname);  
  
  decisions_index decisions(_soviet, coopname.value);
  auto decision_id = get_id(_soviet, coopname, "decisions"_n);
  
  checksum256 hash = eosio::sha256((char*)&withdraw_id, sizeof(withdraw_id));
  
  decisions.emplace(_gateway, [&](auto &d){
    d.id = decision_id;
    d.coopname = coopname;
    d.username = username;
    d.type = _withdraw_action;
    d.batch_id = withdraw_id;
    d.statement = statement;
    d.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    d.hash = hash;
  });

  
  Action::send<newsubmitted_interface>(
    _soviet,
    "newsubmitted"_n,
    _soviet,
    coopname,
    username,
    _withdraw_action,
    hash,
    statement,
    decision_id
  );
};

void soviet::withdraw_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id, uint64_t batch_id) { 

  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Решение не найдено");

  action(
      permission_level{ _soviet, "active"_n},
      _gateway,
      "withdrawauth"_n,
      std::make_tuple(coopname, batch_id)
  ).send();
  
  Action::send<newresolved_interface>(
    _soviet,
    "newresolved"_n,
    _soviet,
    coopname,
    decision -> username,
    _withdraw_action,
    decision -> hash.value(),
    decision -> statement
  );
  
  Action::send<newdecision_interface>(
    _soviet,
    "newdecision"_n,
    _soviet,
    coopname,
    decision -> username,
    _withdraw_action,
    decision -> hash.value(),
    decision -> authorization
  );

  decisions.erase(decision);
}
