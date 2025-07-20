/**
\ingroup public_actions
\brief Отказ от предложения.

* @details Этот метод позволяет пользователю отклонить предложение, представленное к его заявке.
* Выполняются следующие проверки:
* - Существование предложения с указанным ID.
* - Существование основной заявки.
* - Предложение находится в статусе "ожидание".
* 
* Если отклонено предложение к заявке типа "order", осуществляется возврат токенов пользователю, которому были заблокированы токены при создании предложения.
* 
* @param username Имя пользователя, отклоняющего предложение.
* @param exchange_id ID предложения, которое следует отклонить.
* @param meta Дополнительные метаданные, связанные с отказом.
* 
* @note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::decline(eosio::name coopname, eosio::name username, uint64_t exchange_id, std::string meta) { 
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  auto parent_change = exchange.find(change -> parent_id);

  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(parent_change != exchange.end(), "Родительская заявка не найдена");
  eosio::check(change -> status == "published"_n, "Только заявка в статусе ожидания может быть отклонена");

  // ИСПРАВЛЕНИЕ: Если заявка была принята (blocked_units > 0), возвращаем единицы товара в родительскую заявку
  if (change -> blocked_units > 0) {
    exchange.modify(parent_change, _marketplace, [&](auto &e) {
      e.remain_units += change -> blocked_units;
      e.blocked_units -= change -> blocked_units;
      e.supplier_amount = e.remain_units * e.unit_cost;
    });
    
    // Проверяем инварианты после изменения
    auto updated_parent = exchange.find(change -> parent_id);
    marketplace::check_units_invariant(*updated_parent, "decline_parent_update");
  }

  exchange.modify(change, coopname, [&](auto &o){
    o.status = "declined"_n;
    o.declined_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    o.meta = meta;
    o.blocked_units = 0; // Обнуляем заблокированные единицы в дочерней заявке
  });
  
  // Проверяем инварианты дочерней заявки
  auto updated_change = exchange.find(exchange_id);
  marketplace::check_units_invariant(*updated_change, "decline_child_update");

  if (change -> type == "order"_n) {
    std::string memo = "Отказ в поставке по программе №" + std::to_string(change -> program_id) + " с ID: " + std::to_string(change -> id);

    action(
      permission_level{ _marketplace, "active"_n},
      _soviet,
      "unblockbal"_n,
      std::make_tuple(coopname, change -> money_contributor, change -> program_id, change -> total_cost, memo)
    ).send();

  }; 
  
}
