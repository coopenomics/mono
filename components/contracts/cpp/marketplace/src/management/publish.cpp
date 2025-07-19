/**
\ingroup public_actions
\brief Опубликовать товар на маркетплейсе.
*
* Этот метод позволяет владельцу товара опубликовать его на маркетплейсе. Для публикации товар должен находиться в статусе "unpublished".
*
* @param username Имя пользователя, являющегося владельцем заявки.
* @param exchange_id Идентификатор заявки, которую следует опубликовать.
*
* @note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::publish(eosio::name coopname, eosio::name username, uint64_t exchange_id) { 
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);

  staff_index staff(_soviet, coopname.value);
  auto persona = staff.find(username.value);

  eosio::check(change != exchange.end(), "Объявление не найдено");
  eosio::check(change->username == username || (persona != staff.end() && persona -> has_right(_marketplace, "unpublish"_n)), "У вас нет права на публикацию данной заявки");
  eosio::check(change->status == "unpublished"_n || change->status == "prohibit"_n, "Неверный статус для публикации");

  exchange.modify(change, username, [&](auto &o) {
    if (change->status == "unpublished"_n)
      o.status = "published"_n;
    else 
      o.status = "moderation"_n;
  });
}