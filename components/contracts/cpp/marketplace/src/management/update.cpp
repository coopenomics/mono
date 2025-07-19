
/**
\ingroup public_actions
\brief Отмена заявки и возврат токенов.

@details Позволяет пользователю отменить родительскую или дочернюю заявку, а также обеспечивает возврат токенов владельцу (если применимо). При отмене проверяется наличие заявки и её текущий статус. Если заявка является родительской, вызывается метод `cancel_parent`, иначе — `cancel_child`.

@param username Имя пользователя, инициировавшего отмену.
@param exchange_id Идентификатор заявки для отмены.

@note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::update(eosio::name coopname, eosio::name username, uint64_t exchange_id, uint64_t remain_units, eosio::asset unit_cost, std::string data, std::string meta) {
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка на обмен не найдена");
  eosio::check(unit_cost.symbol == change -> unit_cost.symbol, "Неверный символ токен");
  eosio::check(change -> parent_id == 0, "Встречные заявки можно только отменять");
  eosio::check(change -> username == username, "У вас нет права на отмену данной заявки");
  eosio::check(remain_units >= 0, "Количество единиц товара должно быть положительным");

  eosio::name status = "moderation"_n;

  if (change -> data == data && change -> meta == meta) 
    status = change -> status;

  exchange.modify(change, _marketplace, [&](auto &i) {
    i.status = status;
    i.unit_cost = unit_cost;
    i.remain_units = remain_units;
    i.data = data;
    i.meta = meta;
    i.supplier_amount = remain_units * unit_cost;
  });
}
