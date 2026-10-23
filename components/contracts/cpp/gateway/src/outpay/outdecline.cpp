/**
 * @brief Отклонение исходящего платежа.
 * Отклоняет исходящий платеж и вызывает коллбэк отклонения с указанной причиной.
 * @param coopname Наименование кооператива
 * @param outcome_hash Хэш исходящего платежа
 * @param reason Причина отклонения платежа
 * @ingroup public_actions
 * @ingroup public_gateway_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void gateway::outdecline(eosio::name coopname, checksum256 outcome_hash, std::string reason) {
  require_auth(coopname);

  auto exist_outcome = Gateway::get_outcome(coopname, outcome_hash);
  eosio::check(exist_outcome.has_value(), "GATEWAY_OUTCOME_NOT_FOUND: Объект возврата не существует с указанным хэшем");
  Gateway::outcomes_index outcomes(_gateway, coopname.value);

  auto outcome = outcomes.find(exist_outcome -> id);
  
  eosio::check(outcome -> status == "pending"_n, "Только принятые заявления на вывод могут быть обработаны");

  // Используем интерфейс для типизированного вызова callback действия
  Action::send<declinewthd_interface>(
    outcome -> callback_contract,
    outcome -> decline_callback,
    _gateway,
    coopname, 
    outcome -> outcome_hash, 
    reason
  );
  
  outcomes.erase(outcome);
};
