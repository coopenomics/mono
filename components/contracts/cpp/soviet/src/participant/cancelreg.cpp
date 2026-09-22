

/**
 * @brief Отмена регистрации участника
 * Отменяет регистрацию участника в кооперативе, обнуляя его взносы и блокируя аккаунт.
 * Используется при отмене регистрации до принятия решения советом.
 * @param coopname Наименование кооператива
 * @param username Наименование участника для отмены регистрации
 * @param message Сообщение о причине отмены регистрации
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _gateway
 */
void soviet::cancelreg(eosio::name coopname, eosio::name username, std::string message){
  require_auth(_gateway);

  auto cooperative = get_cooperative_or_fail(coopname);
  
  participants_index participants(_soviet, coopname.value);
  
  auto participant = participants.find(username.value);
  
  /** 
    Если отмена регистрации происходит до принятия решения советом - том отменять нам здесь нечего, 
    и мы просто игнорируем код ниже. 
  */
  if (participant != participants.end()) {
    
    //обнуляем кошелёк
    participants.modify(participant, RamPayer::of(participants, coopname), [&](auto &w){
      w.minimum_amount = asset(0, participant -> minimum_amount -> symbol);
      w.initial_amount = asset(0, participant -> initial_amount -> symbol);
      w.has_vote = false;
      w.is_initial = false;
      w.is_minimum = false;
    });
    
    //TODO send block action here
    action(
      permission_level{ _soviet, "active"_n},
      _soviet,
      "block"_n,
      std::make_tuple(coopname, coopname, username, message)
    ).send();
  }
};
