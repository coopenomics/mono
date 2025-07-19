/**
\ingroup public_actions
\brief Снять товар с публикации на маркетплейсе.
*
* Этот метод предназначен для снятия товара с публикации. Только владелец товара может снять его с публикации.
*
* @param username Имя пользователя, являющегося владельцем заявки.
* @param exchange_id Идентификатор заявки, которую следует снять с публикации.
*
* @note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::unpublish(eosio::name coopname, eosio::name username, uint64_t exchange_id) { 
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Объявление не найдено");

  staff_index staff(_soviet, coopname.value);
  auto persona = staff.find(username.value);
  eosio::check(change->username == username || (persona != staff.end() && persona -> has_right(_marketplace, "unpublish"_n)), "У вас нет права на снятие данной заявки");

  exchange.modify(change, username, [&](auto &o){
    o.status = "unpublished"_n;
  });
};