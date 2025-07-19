/**
\ingroup public_actions
\brief Авторизация гарантийного возврата советом

@details Совет авторизует принятие товара от заказчика и его последующую выдачу поставщику

@param coopname Имя кооператива
@param exchange_id Идентификатор встречной заявки с диспутом
@param wreturn_decision_id Идентификатор решения по принятию товара
@param wreturn_authorization Документ авторизации принятия товара
@param wsupply_decision_id Идентификатор решения по выдаче товара поставщику
@param wsupply_authorization Документ авторизации выдачи товара

@note Авторизация требуется от аккаунта: @p _soviet
*/
[[eosio::action]] void marketplace::wauthorize(eosio::name coopname, uint64_t exchange_id, uint64_t wreturn_decision_id, document2 wreturn_authorization, uint64_t wsupply_decision_id, document2 wsupply_authorization) {
  require_auth(_soviet);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);

  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> status == "disputed"_n, "Заявка должна быть в статусе диспута");
  
  // Обновляем wreturn сегмент
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "wreturn"_n, [&](auto &s) {
    s.decision_id = wreturn_decision_id;
    s.authorization = wreturn_authorization;
    s.status = "authorized"_n;
  });

  // Обновляем wsupply сегмент
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "wsupply"_n, [&](auto &s) {
    s.decision_id = wsupply_decision_id;
    s.authorization = wsupply_authorization;
    s.status = "authorized"_n;
  });

  // Обновляем статус заявки
  exchange.modify(change, _soviet, [&](auto &o) { 
    o.status = "wauthorized"_n; 
  });
}; 