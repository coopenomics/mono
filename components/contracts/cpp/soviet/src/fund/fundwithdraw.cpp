/**
 * @brief Создание решения о выводе средств из фонда
 * Создает решение совета о выводе средств из фонда кооператива.
 * Инициирует процесс голосования по выводу средств.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя
 * @param type Тип вывода средств
 * @param withdraw_id Идентификатор вывода средств
 * @param document Документ с описанием вывода средств
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _fund
 */
void soviet::fundwithdraw(eosio::name coopname, eosio::name username, eosio::name type, uint64_t withdraw_id, document2 document) { 
  require_auth(_fund);
  
  decisions_index decisions(_soviet, coopname.value);
  auto decision_id = get_id(_soviet, coopname, "decisions"_n);
  
  checksum256 hash = eosio::sha256((char*)&withdraw_id, sizeof(withdraw_id));
  
  decisions.emplace(_registrator, [&](auto &d){
    d.id = decision_id;
    d.coopname = coopname;
    d.username = username;
    d.type = type;
    d.batch_id = withdraw_id;
    d.statement = document;
    d.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    d.expired_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + _decision_expiration);
    d.hash = hash;
  });
  
  
  Action::send<newsubmitted_interface>(
    _soviet,
    "newsubmitted"_n,
    _soviet,
    coopname,
    username,
    "fundwithdraw"_n,
    hash,
    document,
    decision_id
  );
  
};


void soviet::subaccum_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id, uint64_t secondary_id) { 

  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  
  fundwithdraws_index fundwithdraws(_fund, coopname.value);
  auto withdraw = fundwithdraws.find(secondary_id);
  eosio::check(withdraw != fundwithdraws.end(), "Объект не найден");
  eosio::name username = withdraw -> username;
  document2 document = withdraw -> document;

  action(
      permission_level{ _soviet, "active"_n},
      _fund,
      "authorize"_n,
      std::make_tuple(coopname, decision -> type, secondary_id, decision -> authorization)
  ).send();
  
  Action::send<newresolved_interface>(
    _soviet,
    "newresolved"_n,
    _soviet,
    coopname,
    withdraw -> username,
    decision -> type,
    decision -> hash.value(),
    document
  );
  
  Action::send<newdecision_interface>(
    _soviet,
    "newdecision"_n,
    _soviet,
    coopname,
    withdraw -> username,
    decision -> type,
    decision -> hash.value(),
    decision -> authorization
  );

  decisions.erase(decision);
};
