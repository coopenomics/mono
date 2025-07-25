/**
\ingroup public_actions
\brief Отклонение встречной заявки в направлении deliver_on_offer (declineoff).

@details Позволяет поставщику отклонить встречную заявку (child order) на поставку имущества.

Процесс: OFFER (parent) → ORDER (child)  
- Поставщик отклоняет встречную заявку

@param coopname Имя кооператива
@param username Имя поставщика
@param request_hash Хэш встречной заявки (order)
@param meta Причина отклонения

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::declineoff(eosio::name coopname, eosio::name username, checksum256 request_hash, std::string meta) { 
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "order"_n, "Метод offerdecline применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");
  eosio::check(change.status == "active"_n, "Только активная заявка может быть отклонена");

  // Если заявка была принята (blocked_units > 0), возвращаем единицы товара в родительскую заявку
  if (change.blocked_units > 0) {
    auto parent_itr = requests.find(parent_change.id);
    eosio::check(parent_itr != requests.end(), "Родительская заявка не найдена для обновления");
    requests.modify(parent_itr, _marketplace, [&](auto &p) {
      p.remaining_units += change.blocked_units;
      p.blocked_units -= change.blocked_units;
      p.base_cost = p.remaining_units * p.unit_cost;
    });

    // Проверяем инварианты родительской заявки
    auto updated_parent = requests.find(parent_change.id);
    marketplace::check_units_invariant(*updated_parent, "offerdecline_parent_update");
  }

  // Разблокируем средства заказчика
  if (change.total_cost.amount > 0) {
    std::string memo = "Отклонение встречной заявки поставщиком по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);

    // Списываем средства с ЦПП маркетплейса
    Wallet::sub_blocked_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
    // Начисляем средства на ЦПП Цифровой Кошелёк
    Wallet::add_available_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _wallet_program, memo);
  }

  // Удаляем сегменты встречной заявки
  marketplace::delete_segments_by_request(coopname, change.id);

  // Проверяем равенство количества единиц для определения стратегии удаления
  auto updated_parent = requests.find(parent_change.id);
  bool units_equal = false;
  
  if (updated_parent != requests.end()) {
    units_equal = (change.remaining_units == updated_parent->remaining_units);
  }

  // Удаляем встречную заявку
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для удаления");
  requests.erase(change_itr);

  // Если количество единиц равно - удаляем также родительскую заявку
  if (units_equal && updated_parent != requests.end()) {
    requests.erase(updated_parent);
  }
} 