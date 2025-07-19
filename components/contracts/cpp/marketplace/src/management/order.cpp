/**
\ingroup public_actions
\brief Создать заявку на денежный паевой взнос.
*
* Данный метод позволяет пользователю создать заявку на денежный паевой взнос в системе.
*
* @param params Параметры для создания заявки на денежный паевой взнос.
*
* @note Авторизация требуется от аккаунта: @p params.username
*/
[[eosio::action]] void marketplace::order (const exchange_params& params) {
  require_auth(params.coopname);

  marketplace::create("order"_n, params);

};
