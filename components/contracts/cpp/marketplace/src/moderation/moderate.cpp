/**
\ingroup public_actions
\brief Модерация товара на маркетплейсе.
*
* Данный метод предназначен для модерации товара перед его публикацией на маркетплейсе. 
* Метод может быть вызван только администратором маркетплейса.
*
* @param username Имя пользователя-администратора, который вызывает данный метод.
* @param exchange_id Уникальный идентификатор товара, который нужно опубликовать после модерации.
*
* @note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::moderate(eosio::name coopname, eosio::name username, uint64_t exchange_id, uint64_t cancellation_fee) { 
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Объявление не найдено");

  if (change -> status == "moderation"_n || change -> status == "prohibit"_n) {
    
    eosio::check(cancellation_fee >= 0 && cancellation_fee < 100, "Комиссия отмены должна быть от 0 до 100 процентов");
    eosio::asset cancellation_fee_amount = change -> total_cost * cancellation_fee / 100;

    exchange.modify(change, username, [&](auto &o){
      o.status = "published"_n;
      o.cancellation_fee = cancellation_fee;
      o.cancellation_fee_amount = cancellation_fee_amount;
    });
  }
};
