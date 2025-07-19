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

  exchange.modify(change, coopname, [&](auto &o){
    o.status = "declined"_n;
    o.declined_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    o.meta = meta;
  });

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
