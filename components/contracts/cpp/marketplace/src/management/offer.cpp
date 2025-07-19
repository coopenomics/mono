/**
\ingroup public_actions
\brief Создать заявку на имущественный паевой взнос.
*
* Данный метод позволяет пользователю создать заявку на имущественный паевой взнос в системе.
*
* @param params Параметры для создания заявки на имущественный паевой взнос.
*
* @note Авторизация требуется от аккаунта: @p params.username
*/
[[eosio::action]] void marketplace::offer (const exchange_params& params) {
  require_auth(params.coopname);
  
  marketplace::create("offer"_n, params);
  
};
