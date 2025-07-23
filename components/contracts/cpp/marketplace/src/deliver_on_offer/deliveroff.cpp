/**
\ingroup public_actions
\brief Доставка имущества в направлении deliver_on_offer (deliveroff).

@details Переводит статус заявки из "поставлено" в "доставлено" для дальнейшего получения заказчиком.

Процесс: OFFER (parent) → ORDER (child)
- Переход от поставки к доставке

@param coopname Имя кооператива
@param username Имя пользователя
@param request_hash Хэш встречной заявки (order)

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::deliveroff(eosio::name coopname, eosio::name username, checksum256 request_hash) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "supplied"_n, "Только поставленная заявка может быть доставлена");
  eosio::check(change.type == "order"_n, "Метод offerdeliver применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

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
  marketplace::check_units_invariant(*updated_change, "offerdeliver_child_update");
} 