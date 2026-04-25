/**
\ingroup public_actions
\brief Подтверждение получения заказчиком.

@details Заказчик подтверждает факт получения имущества второй подписью акта приёма-передачи.

@param coopname Имя кооператива
@param username Имя заказчика
@param request_hash Хэш заявки
@param document Акт подтверждения получения

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::receivecnf(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "received1"_n, "Подтверждение возможно только после статуса received1");
  eosio::check(change.money_contributor == username, "Недостаточно прав доступа");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);
  
  // Валидируем документ по registry_id (пока что ноль)
  Document::validate_registry_id(document, 0);

  // Обновляем заявку
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o){
    o.status = "received2"_n;
    o.received_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    // Устанавливаем время окончания гарантийной задержки
    o.warranty_delay_until = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + change.warranty_period_secs);
    // Добавляем акт подтверждения с именем
    Document::add_document(o.documents, DocumentNames::RECEIVE_ACT_CONF, document);
  });

  // Проводки по кошельку
  std::string memo = "Подтверждение получения для заказа №" + std::to_string(change.id);
  
  // Паевой фонд - уменьшаем циркуляцию
  Ledger::sub(_marketplace, coopname, Ledger::accounts::SHARE_FUND, change.base_cost, memo, request_hash, username);
  
  // Заказчик - списываем заблокированный баланс
  Wallet::sub_blocked_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
}; 