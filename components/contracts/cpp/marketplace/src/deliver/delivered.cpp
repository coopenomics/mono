[[eosio::action]] void marketplace::delivered(eosio::name coopname, eosio::name username, uint64_t exchange_id) {
  require_auth(coopname);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> parent_id > 0, "Только продукт по встречной заявке может быть доставлен");

  eosio::check(change -> status == "supplied2"_n, "Продукт может быть поставлен только по заявке в статусе supplied2");

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();

  eosio::check(username == chairman, "Недостаточно прав доступа для подтверждения доставки");

  auto program = get_program_or_fail(coopname, change -> program_id);

  exchange.modify(change, coopname, [&](auto &ch) {
    ch.status = "delivered"_n;
    ch.delivered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    ch.deadline_for_receipt = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + change -> product_lifecycle_secs / 4);
  });
}