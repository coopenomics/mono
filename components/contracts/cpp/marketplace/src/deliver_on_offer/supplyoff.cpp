/**
\ingroup public_actions
\brief Поставка имущества в направлении deliver_on_offer (supplyoff).

@details Поставщик поставляет имущество по встречной заявке и предоставляет акт поставки.

Процесс: OFFER (parent) → ORDER (child)
- Поставщик (автор parent offer) поставляет имущество заказчику

@param coopname Имя кооператива
@param username Имя поставщика
@param request_hash Хэш встречной заявки (order)
@param document Акт поставки имущества

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::supplyoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "authorized"_n, "Только авторизованная заявка может быть поставлена");
  eosio::check(change.type == "order"_n, "Метод offersupply применим только к встречным заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");
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
  marketplace::check_units_invariant(*updated_change, "offersupply_child_update");

  // Сохраняем акт поставки в contribute сегменте
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.act1 = document;
    s.status = "supplied1"_n;
  });
} 