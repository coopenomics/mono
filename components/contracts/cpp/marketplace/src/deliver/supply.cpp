[[eosio::action]] void marketplace::supply(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document) {
  require_auth(coopname);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> parent_id > 0, "Только продукт по встречной заявке может быть поставлен");

  eosio::check(change -> status == "authorized"_n, "Продукт может быть поставлен только по заявке в статусе authorized");

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  
  eosio::check(username == chairman, "Недостаточно прав доступа для подтверждения поставки");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  exchange.modify(change, _marketplace, [&](auto &ch) {
    ch.supplied_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    ch.status = "supplied1"_n;
  });

  // Сохраняем документ валидации акта в contribute сегменте
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "contribute"_n, [&](auto &s) {
    s.act_validation = document;
    s.status = "supplied"_n;
  });
}
