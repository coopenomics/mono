/**
\ingroup public_actions
\brief Исполнение решения совета
*
* Этот метод позволяет исполнить решение совета. Исполнение решения включает в себя проверку, что решение существует, что оно было авторизовано, и что оно еще не было выполнено. В зависимости от типа решения, вызывается соответствующая функция для его реализации.
*
* @param executer Имя аккаунта, который исполняет решение
* @param coopname Имя кооператива
* @param decision_id Идентификатор решения для исполнения
* 
* @note Авторизация требуется от аккаунта: @p executer
*/
void soviet::exec(eosio::name executer, eosio::name coopname, uint64_t decision_id) { 
  require_auth(executer);
  
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
  } else if (decision -> type == _capital_contributor_authorize_action) {//операция регистрации контрибьютора (заключение договора УХД)
    soviet::capital_register_contributor_authorize_action_effect(executer, coopname, decision -> id); 
  } else if (decision -> type == _capital_invest_authorize_action) {//операция приёма паевого взноса с кошелька на проект
    soviet::capital_invest_authorize_action_effect(executer, coopname, decision -> id);
  } else {
    soviet::authorize_action_effect(executer, coopname, decision -> id);
  };
}
