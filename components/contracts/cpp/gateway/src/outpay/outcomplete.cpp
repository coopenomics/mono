/**
 * @brief Завершение обработки исходящего платежа.
 * Завершает обработку исходящего платежа и вызывает коллбэк успеха.
 * @param coopname Наименование кооператива
 * @param outcome_hash Хэш исходящего платежа
 * @ingroup public_actions
 * @ingroup public_gateway_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void gateway::outcomplete(eosio::name coopname, checksum256 outcome_hash){
  require_auth(coopname);
  auto exist_outcome = Gateway::get_outcome(coopname, outcome_hash);
  eosio::check(exist_outcome.has_value(), "GATEWAY_OUTCOME_NOT_FOUND: Объект возврата не существует с указанным хэшем");
  
  Gateway::outcomes_index outcomes(_gateway, coopname.value);

  auto outcome = outcomes.find(exist_outcome -> id);
  
  // Строка стирается после решения кассира, поэтому обработать её повторно нельзя;
  // проверка состояния защищает от будущих промежуточных состояний платежа.
  eosio::check(outcome -> status == "pending"_n, "GATEWAY_OUTCOME_NOT_PENDING: Исходящий платёж уже обработан: решение кассира по нему принято");
  
  // Используем интерфейс для типизированного вызова callback действия
  Action::send<completewthd_interface>(
    outcome -> callback_contract,
    outcome -> confirm_callback,
    _gateway,
    coopname, 
    outcome -> outcome_hash
  );

  outcomes.erase(outcome);  
};
