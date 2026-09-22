/**
 * @brief Блокировка участника кооператива
 * Блокирует участника кооператива, лишая его права голоса и активного статуса.
 * Уменьшает счетчик активных пайщиков при блокировке активного участника.
 * @param coopname Наименование кооператива
 * @param admin Наименование администратора
 * @param username Наименование блокируемого участника
 * @param message Сообщение о причине блокировки
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _soviet или @p admin
 */
void soviet::block(eosio::name coopname, eosio::name admin, eosio::name username, std::string message) {
  
  //блокировку может выписать контракт или администратор
  auto payer = check_auth_and_get_payer_or_fail({_soviet, admin});
  
  //если администратор - проверяем дополнительно его права
  if (payer == admin)
    check_auth_or_fail(_soviet, coopname, admin, "block"_n);
    
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  
  // Сохраняем текущие значения статуса и права голоса
  bool had_vote = participant->has_vote;
  bool was_active = participant->status == "accepted"_n;
  
  participants.modify(participant, RamPayer::of(participants, coopname), [&](auto &row){
      row.status = "blocked"_n;
      row.is_initial = false;
      row.is_minimum = false;
      row.has_vote = false;    
  });
  
  // Если участник был активен и имел право голоса, уменьшаем счетчик активных пайщиков
  if (was_active && had_vote) {
    // Отправляем уведомление в registrator для уменьшения счетчика
    action(
      permission_level{_soviet, "active"_n},
      _registrator,
      "decparticpnt"_n,
      std::make_tuple(coopname, username)
    ).send();
  }
}