/**
 * @brief Исполнение решения совета
 * @ingroup public_actions
 * @ingroup public_soviet_actions

*
* Этот метод позволяет исполнить решение совета. Исполнение решения включает в себя проверку, что решение существует, что оно было авторизовано, и что оно еще не было выполнено. В зависимости от типа решения, вызывается соответствующая функция для его реализации.
*
* @param executer Имя аккаунта, который исполняет решение
* @param coopname Имя кооператива
* @param decision_id Идентификатор решения для исполнения
* 
* @note Авторизация требуется от аккаунта: @p coopname
*/
void soviet::exec(eosio::name executer, eosio::name coopname, uint64_t decision_id) {
  // Исполнение проводится через бэкенд ключом кооператива. Параметр executer остаётся
  // в payload как аудит-метка (кто инициировал исполнение) и не используется для авторизации
  // inline-эффектов — те выполняются под собственными правами контракта (_soviet/_gateway/_fund).
  require_auth(coopname);

  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  
  eosio::check(decision != decisions.end(),"Решение не найдено в оперативной памяти");
  eosio::check(decision -> authorized == true, "Только авторизованное решение может быть исполнено");
  
  if (decision -> type == _withdraw_action){//операция возврата паевого взноса из кошелька (вывод)
    soviet::withdraw_effect(executer, coopname, decision->id, decision->batch_id);
  } else if (decision -> type == _afund_withdraw_action) {//операция использования фонда накопления
    soviet::subaccum_effect(executer, coopname, decision->id, decision->batch_id);
  } else if (decision -> type == _free_decision_action) {//операция свободного решения
    soviet::freedecision_effect(executer, coopname, decision->id);
  } else {
    soviet::authorize_action_effect(executer, coopname, decision -> id);
  };
}
