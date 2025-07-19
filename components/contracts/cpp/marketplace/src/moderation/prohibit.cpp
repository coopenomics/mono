

/**
\ingroup public_actions
\brief Отказ в прохождении модерации заявки на товар.
*
* Этот метод предназначен для администраторов маркетплейса, чтобы отказать в публикации товара после его модерации. 
* При отказе администратор указывает причину отказа в параметре `meta`.
*
* @param username Имя пользователя-администратора, который вызывает данный метод.
* @param exchange_id Уникальный идентификатор товара, публикацию которого нужно запретить.
* @param meta Строковое описание или причина, по которой товар не прошел модерацию.
*
* @note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::prohibit(eosio::name coopname, eosio::name username, uint64_t exchange_id, std::string meta) { 
  require_auth(coopname);
  
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Объявление не найдено");

  exchange.modify(change, username, [&](auto &o){
    o.status = "prohibit"_n;
    o.meta = meta;
  });
  
};
