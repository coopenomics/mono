/**
 * @brief Создание повестки дня для голосования совета
 * Создает новую повестку дня для голосования совета по различным вопросам кооператива.
 * Инициирует процесс принятия решения с указанными параметрами и обратными вызовами.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, создающего повестку
 * @param type Тип повестки/решения
 * @param hash Хеш документа или объекта для решения
 * @param callback_contract Контракт для обратного вызова
 * @param confirm_callback Действие подтверждения
 * @param decline_callback Действие отклонения
 * @param statement Документ с описанием повестки
 * @param meta Дополнительные метаданные
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
[[eosio::action]] void soviet::createagenda(eosio::name coopname, eosio::name username, eosio::name type, checksum256 hash, name callback_contract, name confirm_callback, name decline_callback, document2 statement, std::string meta){
  auto payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  decisions_index decisions(_soviet, coopname.value);
  
  auto decision_id = get_id(_soviet, coopname, "decisions"_n);
  
  decisions.emplace(_soviet, [&](auto &d) {
    d.id = decision_id;
    d.coopname = coopname;
    d.username = username;
    d.type = type;
    d.hash = hash;
    d.statement = statement;
    d.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    d.expired_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + _decision_expiration);
    d.meta = meta;
    d.callback_contract = callback_contract;
    d.confirm_callback = confirm_callback;
    d.decline_callback = decline_callback;
  });
  
  Action::send<newsubmitted_interface>(
    _soviet,
    "newsubmitted"_n,
    _soviet,
    coopname,
    username,
    type,
    hash,
    statement,
    decision_id
  );
}



void soviet::authorize_action_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id) { 
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  
  eosio::check(decision != decisions.end(), "Решение не найдено");
  
  action(
    permission_level{ _soviet, "active"_n},
    decision -> callback_contract.value(),
    decision -> confirm_callback.value(),
    std::make_tuple(coopname, decision -> hash, decision -> authorization)
  ).send();
  
  checksum256 decision_hash = eosio::sha256((char*)&decision_id, sizeof(decision_id));
  
  Action::send<newresolved_interface>(
    _soviet, 
    "newresolved"_n,
    _soviet,
    coopname,
    decision -> username,
    decision -> type,
    decision -> hash.value(),
    decision -> statement
  );
  
  Action::send<newdecision_interface>(
    _soviet,
    "newdecision"_n,
    _soviet,
    coopname,
    decision -> username,
    decision -> type,
    decision -> hash.value(),
    decision -> authorization
  );
  
  decisions.erase(decision);
}