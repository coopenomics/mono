
/**
\ingroup public_actions
\brief Подтверждение готовности выполнить заявку.

@details Данный метод позволяет пользователю, который получил предложение по своей заявке, подтвердить свою готовность его принять и выполнить. При этом формируется пакет документов, который отправляется в совет на утверждение. 

@param username Имя пользователя, подтверждающего готовность выполнить предложение.
@param exchange_id ID предложения, которое следует подтвердить.
 
@note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::accept(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document) { 
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> status == "published"_n, "Только заявка в статусе ожидания может быть принята");

  auto parent_change = exchange.find(change -> parent_id);
  eosio::check(parent_change != exchange.end(), "Родительская заявка не найдена");
  eosio::check(parent_change -> username == username, "Недостаточно прав доступа");
  eosio::check(parent_change -> remain_units >= change -> remain_units, "Недостаточно объектов для поставки");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Создаем сегменты на встречной заявке
  uint64_t contribute_segment_id = marketplace::create_segment(coopname, exchange_id, "contribute"_n);
  uint64_t return_segment_id = marketplace::create_segment(coopname, exchange_id, "return"_n);

  exchange.modify(parent_change, _marketplace, [&](auto &i) {
    i.remain_units -= change -> remain_units;
    i.supplier_amount = (parent_change -> remain_units - change -> remain_units ) * parent_change -> unit_cost;
    i.blocked_units += change -> remain_units;
  });

  exchange.modify(change, _marketplace, [&](auto &o){
    o.status = "accepted"_n;
    o.blocked_units += change -> remain_units;
    o.remain_units = 0;
    o.accepted_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });

  // Сохраняем документ в соответствующем сегменте
  if (change -> type == "order"_n) {
    // Для заказа сохраняем документ в contribute сегменте
    marketplace::update_segment(coopname, contribute_segment_id, [&](auto &s) {
      s.statement = document;
      s.status = "statement"_n;
    });
  } else if (change -> type == "offer"_n) {
    // Для предложения сохраняем документ в return сегменте
    marketplace::update_segment(coopname, return_segment_id, [&](auto &s) {
      s.statement = document;
      s.status = "statement"_n;
    });
  };

  action(
    permission_level{ _marketplace, "active"_n},
    _soviet,
    _change_action,
    std::make_tuple(change -> coopname, username, change -> username, exchange_id, change -> money_contributor, change -> product_contributor)
  ).send();
}
