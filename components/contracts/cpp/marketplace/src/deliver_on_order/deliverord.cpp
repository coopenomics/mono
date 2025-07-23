/**
\ingroup public_actions
\brief Доставка товара для направления deliver_on_order (deliverord).

@details Данный метод используется для фиксации доставки имущества от поставщика к заказчику.
Встречная заявка должна быть предварительно в статусе "поставлено".

Процесс: ORDER (parent) → OFFER (child)  
- Parent: денежный паевой взнос (заказчик)
- Child: имущественный паевой взнос (поставщик)

@param coopname Имя кооператива
@param username Имя председателя совета
@param request_hash Хэш встречной заявки (offer)

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::deliverord(eosio::name coopname, eosio::name username, checksum256 request_hash) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();

  eosio::check(change.status == "supplied"_n, "Только поставленная заявка может быть доставлена");
  eosio::check(change.type == "offer"_n, "Метод orderdeliver применим только к заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "delivered"_n;
    o.delivered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    o.delivered_units = o.blocked_units;
    o.deadline_for_receipt = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + 3 * 24 * 60 * 60); // 3 дня на подтверждение
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "orderdeliver_update");
} 