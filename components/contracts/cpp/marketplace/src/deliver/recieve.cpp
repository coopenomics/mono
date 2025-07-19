/**
\ingroup public_actions
\brief Подпись акта получения имущества пайщиком
**/

[[eosio::action]] void marketplace::recieve(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document) { 
  require_auth(coopname);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> parent_id > 0, "Только продукт по встречной заявке может быть выдан");

  eosio::check(change -> status == "delivered"_n, "Продукт может быть выдан только по заявке в статусе ожидания получения");

  eosio::check(change -> deadline_for_receipt.sec_since_epoch() >= eosio::current_time_point().sec_since_epoch(), "Время на выдачу имущества истекло");
  
  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  if (change -> type == "order"_n) { //если указанная заявка - это заказ продукта
    //то получение продукта может осуществить только пользователь из username
    eosio::check(change -> username == username, "Недостачно прав доступа для получения имущества");
  } else { //если указанная заявка - это поставка продукта

    //то поставку может осуществить только пользователь username в этой заявке
    eosio::check(change -> parent_username == username, "Недостаточно прав доступа для получения имущества");
  };

  //подписываем акт приёма-передачи кооперативу пайщиком
  exchange.modify(change, coopname, [&](auto &ch){
    ch.status = "recieved1"_n;
    ch.recieved_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    ch.warranty_delay_until = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + change -> product_lifecycle_secs / 4);
  });

  // Сохраняем акт получения в return сегменте
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "return"_n, [&](auto &s) {
    s.act = document;
    s.status = "recieved"_n;
  });
}

