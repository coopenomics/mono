/**
 * @brief Создание исходящего платежа.
 * Создает новый запрос на исходящий платеж в системе процессинга.
 * @param coopname Наименование кооператива
 * @param username Имя пользователя, запрашивающего платеж
 * @param outcome_hash Хэш исходящего платежа
 * @param quantity Количество средств
 * @param callback_contract Контракт для вызова коллбэков
 * @param confirm_callback Действие успеха
 * @param decline_callback Действие отклонения
 * @ingroup public_actions
 * @ingroup public_gateway_actions

 * @note Авторизация требуется от аккаунта из белого списка контрактов
 */
void gateway::createoutpay(eosio::name coopname, eosio::name username, checksum256 outcome_hash, eosio::asset quantity, name callback_contract, name confirm_callback, name decline_callback){
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);

  Wallet::validate_asset(quantity);
  
  auto cooperative = get_cooperative_or_fail(coopname);
  
  eosio::check(callback_contract != ""_n, "Коллбэк контракт должен быть установлен");
  eosio::check(confirm_callback != ""_n, "Действие для коллбэка-успеха должено быть установлено");
  eosio::check(decline_callback != ""_n, "Действие для коллбэка-отлонения должно быть установлено");
  
  // Валидируем callback действия если они от wallet контракта
  if (callback_contract == _wallet) {
    Wallet::get_valid_wallet_action(confirm_callback);
    Wallet::get_valid_wallet_action(decline_callback);
  }
  
  auto outcome = Gateway::get_outcome(coopname, outcome_hash);
  
  eosio::check(!outcome.has_value(), "Объект возврата уже существует с указанным хэшем");
  Gateway::outcomes_index outcomes(_gateway, coopname.value);

  uint64_t id = get_global_id(_gateway, "outcomes"_n);

  //TODO make coopname payer
  outcomes.emplace(RamPayer::of(outcomes, coopname), [&](auto &d) {
    d.id = id;
    d.outcome_hash = outcome_hash;
    d.callback_contract = callback_contract;
    d.confirm_callback = confirm_callback;
    d.decline_callback = decline_callback;
    d.username = username;
    d.coopname = coopname;
    d.quantity = quantity;
    d.status = "pending"_n;
  });
};
