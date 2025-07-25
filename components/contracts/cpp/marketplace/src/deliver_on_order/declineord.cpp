/**
\ingroup public_actions
\brief Отказ от заказа в направлении deliver_on_order (declineord).

@details Этот метод позволяет заказчику отклонить встречную заявку поставщика типа offer.

Процесс: ORDER (parent) → OFFER (child)
- Заказчик отклоняет заявку поставщика

@param coopname Имя кооператива
@param username Имя заказчика, отклоняющего заявку
@param request_hash Хэш встречной заявки (offer), которую следует отклонить
@param meta Дополнительные метаданные, связанные с отказом

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::declineord(eosio::name coopname, eosio::name username, checksum256 request_hash, std::string meta) { 
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "offer"_n, "Метод orderdecline применим только к заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");
  eosio::check(change.status == "active"_n, "Только активная заявка может быть отклонена");

  // Если заявка была принята (blocked_units > 0), возвращаем единицы товара в родительскую заявку
  if (change.blocked_units > 0) {
    auto parent_itr = requests.find(parent_change.id);
    eosio::check(parent_itr != requests.end(), "Родительская заявка не найдена для обновления");
    requests.modify(parent_itr, _marketplace, [&](auto &e) {
      e.remaining_units += change.blocked_units;
      e.blocked_units -= change.blocked_units;
      e.base_cost = e.remaining_units * e.unit_cost;
    });
    
    // Проверяем инварианты после изменения
    auto updated_parent = requests.find(parent_change.id);
    marketplace::check_units_invariant(*updated_parent, "orderdecline_parent_update");
  }

  // Обновляем встречную заявку
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, coopname, [&](auto &o){
    o.status = "declined"_n;
    o.declined_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    o.meta = meta;
    o.blocked_units = 0; // Обнуляем заблокированные единицы в дочерней заявке
  });
  
  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "orderdecline_child_update");

  // Примечание: В процессе ORDER → OFFER разблокировка средств не требуется,
  // так как средства блокируются у заказчика при создании родительской заявки order,
  // а не при создании встречной заявки offer
  
  // Проверяем равенство количества единиц для определения стратегии удаления
  auto updated_parent = requests.find(parent_change.id);
  bool units_equal = (change.remaining_units == updated_parent->remaining_units);
  
  if (units_equal) {
    // Если количество единиц равно - удаляем обе заявки
    requests.erase(updated_parent);
    requests.erase(updated_change);
  } else {
    // Иначе удаляем только встречную заявку
    requests.erase(updated_change);
  }
} 