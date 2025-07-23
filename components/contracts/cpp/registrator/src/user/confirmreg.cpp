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

  //добавляем   
  Fund::add_circulating_funds(_registrator, coopname, candidate -> minimum);
  
  Fund::add_initial_funds(_registrator, coopname, candidate -> initial);
  
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
