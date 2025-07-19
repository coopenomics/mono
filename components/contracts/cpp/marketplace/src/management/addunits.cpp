/**
\ingroup public_actions
\brief Добавление единиц товара к заявке.

@details Метод позволяет владельцу заявки дополнительно увеличить количество товара, доступное для обмена в рамках указанной заявки. 
Используется, когда у продавца появляется дополнительное количество товара, которое он хочет добавить к существующей заявке.

@param username Имя пользователя, инициировавшего добавление.
@param exchange_id Идентификатор заявки, к которой добавляются единицы товара.
@param units Количество новых единиц товара, которые следует добавить к заявке.

@note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::addunits(eosio::name coopname, eosio::name username, uint64_t exchange_id, uint64_t units) {
  require_auth(coopname);
    
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  
  eosio::check(change -> username == username, "У вас нет прав на редактирование данной заявки");
  eosio::check(change -> parent_id == 0, "Нельзя отредактировать количество единиц во встречной заявке. Отмените её и пересоздайте");

  exchange.modify(change, _marketplace, [&](auto &c){
    c.remain_units += units;
    c.supplier_amount = (change -> remain_units + units) * change -> unit_cost;
  });
  
};
