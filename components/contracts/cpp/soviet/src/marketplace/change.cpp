/**
\ingroup public_actions
\brief Обмен в кооперативе
*
* Этот метод вызывается контрактом marketplace при создании запроса на обмен в кооперативе. При успешном вызове формируется повестка со всеми сопровождающими документами, которая отправляется на голосование членам совета.
*
* @param coopname Имя кооператива
* @param exchange_id Идентификатор обмена
* @param orderer Участник, который вносит денежный паевый взнос
* @param offerer Участник, который вносит имущественный паевый взнос
* @param quantity Сумма взаимного зачёта
* 
* @note Авторизация требуется от аккаунта: @p _marketplace
*/
void soviet::change(eosio::name coopname, eosio::name parent_username, eosio::name username, uint64_t exchange_id, eosio::name money_contributor, eosio::name product_contributor) { 
  require_auth(_marketplace);  

  decisions_index decisions(_soviet, coopname.value);
  auto decision_id_1 = get_id(_soviet, coopname, "decisions"_n);
  auto decision_id_2 = get_id(_soviet, coopname, "decisions"_n);
    
  changes_index changes(_soviet, coopname.value);
  auto batch_id = get_global_id(_soviet, "change"_n);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не обнаружена");

  changes.emplace(_marketplace, [&](auto &c) {
    c.id = batch_id;
    c.exchange_id = exchange_id;
    c.contribution_product_decision_id = decision_id_1;
    c.return_product_decision_id = decision_id_2;
  });
  
  // Вызов для первого решения
  checksum256 hash = eosio::sha256((char*)&batch_id, sizeof(batch_id));

  decisions.emplace(_soviet, [&](auto &d) {
    d.id = decision_id_1;
    d.type = _change_action;
    d.batch_id = batch_id;
    d.coopname = coopname;
    d.username = product_contributor;  
    d.statement = change -> contribute_product_statement;
    d.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    d.expired_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + _decision_expiration);
    d.hash = hash;
  });
  
  decisions.emplace(_soviet, [&](auto &d){
    d.id = decision_id_2;
    d.type = _change_action;
    d.batch_id = batch_id;
    d.coopname = coopname;
    d.username = money_contributor;
    d.statement = change -> return_product_statement;
    d.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    d.expired_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + _decision_expiration);
    d.hash = hash;  
  });

  Action::send<newsubmitted_interface>(
    _soviet,
    "newsubmitted"_n,
    _soviet,
    coopname,
    product_contributor,
    _product_contribution_action,
    hash,
    change -> contribute_product_statement,
    decision_id_1
  );
  
  // Вызов для второго решения
  
  Action::send<newsubmitted_interface>(
    _soviet,
    "newsubmitted"_n,
    _soviet,
    coopname,
    money_contributor,
    _product_return_action,
    hash,
    change -> return_product_statement,
    decision_id_2
  );

};



void soviet::change_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id, uint64_t batch_id) { 
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  
  eosio::check(decision != decisions.end(), "Решение не найдено");

  changes_index changes(_soviet, coopname.value);
  auto change = changes.find(batch_id);
  eosio::check(change != changes.end(), "Объект обмена не найден");
  
  auto contribution_product_decision = decisions.find(change -> contribution_product_decision_id);
  auto return_product_decision = decisions.find(change -> return_product_decision_id);

  eosio::check(contribution_product_decision != decisions.end(), "Черновик решения о приёме имущества не найден");
  eosio::check(return_product_decision != decisions.end(), "Черновик решения о возврате взноса не найден");

  if (contribution_product_decision -> authorized == true && return_product_decision -> authorized == true){
    // если принимается второе решение, то эффект должен оповестить контракт кооплейса
    
    action(
      permission_level{ _soviet, "active"_n},
      _marketplace,
      "authorize"_n,
      std::make_tuple(coopname, change -> exchange_id, contribution_product_decision -> id, contribution_product_decision -> authorization, return_product_decision -> id, return_product_decision -> authorization)
    ).send();

    decisions.erase(contribution_product_decision);
    decisions.erase(return_product_decision);
    changes.erase(change);

  } else {
    print("Ожидаем получение второго решения");
    // если принимается первое решение, то эффекта при обмене не должно быть
    // просто ждём второе решение
  }
};
