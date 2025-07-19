/**
\ingroup public_actions
\brief Отмена заявки и возврат токенов.

@details Позволяет пользователю отменить родительскую или дочернюю заявку, а также обеспечивает возврат токенов владельцу (если применимо). При отмене проверяется наличие заявки и её текущий статус. 

@param username Имя пользователя, инициировавшего отмену.
@param exchange_id Идентификатор заявки для отмены.

@note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::cancel(eosio::name coopname, eosio::name username, uint64_t exchange_id) { 
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  
  //TODO перенести под проверку пользователя и вообще сценарий отмены проверить полностью
  eosio::check(change -> status != "accepted"_n, "Заявка не может быть отменена сейчас");

  if (change -> parent_id == 0) {
    marketplace::cancel_parent(coopname, username, exchange_id);
  } else {
    marketplace::cancel_child(coopname, username, exchange_id);
  };
}
