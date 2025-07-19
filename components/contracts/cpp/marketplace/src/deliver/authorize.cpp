/**
\ingroup public_actions
\brief Авторизация обмена советом.

@details Метод используется для подтверждения согласия совета на заявленный обмен. 
Обычно этот метод вызывается после прохождения определенного процесса голосования или принятия решения советом.
Авторизованный обмен считается утвержденным и может быть выполнен.

@param exchange_id Идентификатор заявки на обмен, которую следует авторизовать.

@note Авторизация требуется от аккаунта: @p _soviet
*/
[[eosio::action]] void marketplace::authorize(eosio::name coopname, uint64_t exchange_id, uint64_t contribution_product_decision_id, document2 contribution_product_authorization, uint64_t return_product_decision_id, document2 return_product_authorization) {
  require_auth(_soviet);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);

  eosio::check(change != exchange.end(), "Ордер не найден");
  
  exchange.modify(change, _soviet, [&](auto &o) { 
    o.status = "authorized"_n; 
  });

  // Обновляем contribute сегмент
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "contribute"_n, [&](auto &s) {
    s.decision_id = contribution_product_decision_id;
    s.authorization = contribution_product_authorization;
    s.status = "authorized"_n;
  });

  // Обновляем return сегмент  
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "return"_n, [&](auto &s) {
    s.decision_id = return_product_decision_id;
    s.authorization = return_product_authorization;
    s.status = "authorized"_n;
  });
};