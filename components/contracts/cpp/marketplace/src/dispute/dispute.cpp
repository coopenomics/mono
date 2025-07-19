/**
\ingroup public_actions
\brief Открытие диспута по гарантийному возврату

@details Заказчик может открыть диспут, если имеет претензии к полученному товару.
При диспуте создаются два новых сегмента:
- wreturn - для возврата товара от заказчика в кооператив  
- wsupply - для последующей выдачи товара поставщику из кооператива

@param username Имя заказчика, открывающего диспут
@param exchange_id Идентификатор встречной заявки
@param document Документ с претензией/декларацией

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::dispute(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document){

  require_auth(coopname);
    
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  
  eosio::check(change -> type == "order"_n, "Спор может быть открыт только по заявке на поставку");
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> username == username, "Только заказчик может открыть спор");
  eosio::check(change -> is_warranty_return == false, "Нельзя открыть спор на спор");

  auto parent_change = exchange.find(change -> parent_id);
  eosio::check(parent_change != exchange.end(), "Родительская заявка не найдена");

  eosio::check(change -> status == "recieved2"_n, "Неверный статус для открытия спора");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Обновляем статус заявки на "disputed"
  exchange.modify(change, _marketplace, [&](auto &e){
    e.status = "disputed"_n;
    e.disputed_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    e.is_warranty_return = true;
  });

  // Создаем сегмент для возврата товара от заказчика в кооператив
  uint64_t wreturn_segment_id = marketplace::create_segment(coopname, exchange_id, "wreturn"_n);
  
  // Создаем сегмент для выдачи товара из кооператива поставщику  
  uint64_t wsupply_segment_id = marketplace::create_segment(coopname, exchange_id, "wsupply"_n);

  // Сохраняем документ с претензией в wreturn сегменте
  marketplace::update_segment(coopname, wreturn_segment_id, [&](auto &s) {
    s.statement = document;
    s.status = "statement"_n;
  });

  print("Диспут открыт. Созданы сегменты: wreturn=", wreturn_segment_id, ", wsupply=", wsupply_segment_id);
};