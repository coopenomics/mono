/**
\ingroup public_actions
\brief Подтверждение получения имущества председателем в направлении deliver_on_offer (recvcnfoff).

@details Председатель совета подтверждает получение имущества заказчиком и переводит статус на received2.

Процесс: OFFER (parent) → ORDER (child)
- Председатель подтверждает получение имущества заказчиком

@param coopname Имя кооператива
@param username Имя председателя
@param request_hash Хэш встречной заявки (order)
@param document Акт подтверждения получения

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::recvcnfoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "order"_n, "Метод offerrecievecnfrm применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

  eosio::check(change.status == "received1"_n, "Подтверждение получения возможно только в статусе received1");

  eosio::check(username == change.money_contributor, "Недостаточно прав доступа для подтверждения получения");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Уменьшаем паевой фонд на сумму возвращаемой стоимости имущества заказчику
  Fund::sub_circulating_funds(_marketplace, coopname, change.total_cost, false);

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &ch) {
    ch.status = "received2"_n;
    ch.received_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    ch.warranty_delay_until = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + change.product_lifecycle_secs / 4);
  });
  
  // Сохраняем акт получения в return сегменте
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("c2r"), [&](auto &s) {
    s.act2 = document;
    s.status = "received2"_n;
  });
} 