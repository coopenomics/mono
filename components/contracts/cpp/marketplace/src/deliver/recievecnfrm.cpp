[[eosio::action]] void marketplace::recievecnfrm(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document) {
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> parent_id > 0, "Только продукт по встречной заявке может быть поставлен");

  eosio::check(change -> status == "recieved1"_n, "Продукт может быть поставлен только по заявке в статусе recieved1");

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  
  eosio::check(username == chairman, "Недостачно прав доступа для подтверждения выдачи имущества");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  exchange.modify(change, _marketplace, [&](auto &ch) {
    ch.status = "recieved2"_n;
  });

  // Сохраняем документ валидации акта получения в return сегменте
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "return"_n, [&](auto &s) {
    s.act_validation = document;
    s.status = "recieved"_n;
  });

  action(
    permission_level{ _marketplace, "active"_n},
    _soviet,
    "recieved"_n,
    std::make_tuple(coopname, exchange_id)
  ).send();

  //уменьшаем паевой фонд
  action(
    permission_level{ _marketplace, "active"_n},
    _fund,
    "subcirculate"_n,
    std::make_tuple(coopname, change -> total_cost, false)
  ).send(); 
}