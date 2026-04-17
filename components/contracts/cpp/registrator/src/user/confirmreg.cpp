/**
 * @brief Подтверждение регистрации пользователя.
 * Подтверждает регистрацию кандидата советом и добавляет его в кооператив
 * @param coopname Наименование кооператива
 * @param registration_hash Хэш регистрации
 * @param authorization Документ авторизации от совета
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void registrator::confirmreg(eosio::name coopname, checksum256 registration_hash, document2 authorization)
{
  require_auth(_soviet);
  
  auto candidate = Registrator::get_candidate_by_hash(coopname, registration_hash);
  eosio::check(candidate.has_value(), "Кандидат не найден");
  
  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(candidate -> username.value);
  
  //оповещаем пользователя
  require_recipient(candidate -> username);
  
  accounts.modify(account, _registrator, [&](auto &acc){
    acc.status = "active"_n;
  });
  
  eosio::time_point_sec now = current_time_point();
  
  //создаём объект пайщика
  action(
    permission_level{_registrator, "active"_n}, 
    _soviet, 
    "addpartcpnt"_n,
    std::make_tuple(
      coopname, 
      candidate -> username, 
      candidate -> braname,
      account -> type, 
      now, 
      candidate -> initial, 
      candidate -> minimum, 
      true
    )
  ).send();

  std::string memo = "Минимальный паевой взнос при вступлении пайщика с username=" + candidate -> username.to_string();
  Ledger2::apply(_registrator, coopname, ledger2_ops::INITIAL_SHARE, candidate -> minimum, candidate -> username, registration_hash, memo);

  memo = "Вступительный взнос при вступлении пайщика с username=" + candidate -> username.to_string();
  Ledger2::apply(_registrator, coopname, ledger2_ops::ENTRANCE_FEE, candidate -> initial, candidate -> username, registration_hash, memo);
  // Увеличиваем счетчик активных пайщиков
  cooperatives2_index cooperatives(_registrator, _registrator.value);
  auto coop_itr = cooperatives.find(coopname.value);
  
  if (coop_itr != cooperatives.end() && coop_itr->is_cooperative) {
    cooperatives.modify(coop_itr, _registrator, [&](auto &coop) {
      if (coop.active_participants_count.has_value()) {
        coop.active_participants_count = coop.active_participants_count.value() + 1;
      } else {
        coop.active_participants_count = 1;
      }
    });
  }
  
  Registrator::candidates_index candidates(_registrator, coopname.value);
  auto it = candidates.find(candidate -> username.value);
  candidates.erase(it);
}
