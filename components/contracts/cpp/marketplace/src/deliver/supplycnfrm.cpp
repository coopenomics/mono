/**
\ingroup public_actions
\brief Подтверждение поставки.
**/

[[eosio::action]] void marketplace::supplycnfrm(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document) { 
  require_auth(coopname);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> parent_id > 0, "Только продукт по встречной заявке может быть поставлен");

  eosio::check(change -> status == "supplied1"_n, "Продукт может быть поставлен только по заявке в статусе supplied1");

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
    
  eosio::check(change -> product_contributor == username, "Недостаточно прав доступа для совершения поставки");

  // Проверяем подпись документа
  verify_document_or_fail(document);

  //подписываем акт приёма-передачи кооперативу пайщиком
  exchange.modify(change, coopname, [&](auto &ch) {
    ch.status = "supplied2"_n;
  });
  
  // Сохраняем акт в contribute сегменте
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "contribute"_n, [&](auto &s) {
    s.act = document;
    s.status = "supplied"_n;
  });
  
  std::string memo = "Приём имущественного паевого взноса по программе №" + std::to_string(change -> program_id) + " с ID: " + std::to_string(change -> id);

  action(
    permission_level{ _marketplace, "active"_n},
    _soviet,
    "addbal"_n,
    std::make_tuple(coopname, change -> product_contributor, change -> program_id, change -> supplier_amount, memo)
  ).send();

  action(
    permission_level{ _marketplace, "active"_n},
    _soviet,
    "blockbal"_n,
    std::make_tuple(coopname, change -> product_contributor, change -> program_id, change -> supplier_amount, memo)
  ).send();

  //увеличиваем паевой фонд
  action(
    permission_level{ _marketplace, "active"_n},
    _fund,
    "addcirculate"_n,
    std::make_tuple(coopname, change -> total_cost)
  ).send();
}
