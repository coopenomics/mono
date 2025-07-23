/**
\ingroup public_actions
\brief Поставка товара для направления deliver_on_order (supplyord).

@details Данный метод позволяет поставщику зафиксировать поставку имущества. 
Встречная заявка должна быть предварительно авторизована советом.

Процесс: ORDER (parent) → OFFER (child)
- Parent: денежный паевой взнос (заказчик)
- Child: имущественный паевой взнос (поставщик)

@param coopname Имя кооператива
@param username Имя поставщика, предоставляющего товар или услугу
@param request_hash Хэш встречной заявки (offer)
@param document Документ, подтверждающий поставку товара или услуги
 
@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::supplyord(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "authorized"_n, "Только авторизованная заявка может быть поставлена");
  eosio::check(change.type == "offer"_n, "Метод ordersupply применим только к встречным заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");
  
  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");

  eosio::check(change.product_contributor == username, "Недостаточно прав доступа передачи имущества");

  //проводим проверку подписи документа
  verify_document_or_fail(document);

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "supplied1"_n;
    o.supplied_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "ordersupply_update");

  // Обновляем contribute сегмент документом поставки
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.act1 = document;
    s.status = "supplied1"_n;
  });
} 