void soviet::unblock(eosio::name coopname, eosio::name admin, eosio::name username, bool is_registration, std::string message) {
  //разблокировку может выписать контракт или администратор
  auto payer = check_auth_and_get_payer_or_fail({_soviet, admin});
  
  auto cooperative = get_cooperative_or_fail(coopname);  

  //если администратор - проверяем дополнительно его права
  if (payer == admin)
    check_auth_or_fail(_soviet, coopname, admin, "unblock"_n);
    
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  
  eosio::asset minimum = participant -> type.value() == "organization"_n ? cooperative.org_minimum.value() : cooperative.minimum;
  eosio::asset initial = participant -> type.value() == "organization"_n ? cooperative.org_initial.value() : cooperative.initial;
    
  // if (is_registration == true) {
  //   eosio::check(!participant -> is_minimum && !participant -> is_initial, "Пайщик уже совершил вступительный и минимальный паевой взносы");
    
  //   //добавить мин паевой взнос в паевой фонд
  //   action(
  //     permission_level{ _gateway, "active"_n},
  //     _fund,
  //     "addcirculate"_n,
  //     std::make_tuple(coopname, minimum)
  //   ).send();
    
  //   //добавить вступительный взнос в кошелёк вступительных взносов
  //   action(
  //     permission_level{ _gateway, "active"_n},
  //     _fund,
  //     "addinitial"_n,
  //     std::make_tuple(coopname, initial)
  //   ).send();      
  // } 
  
  participants.modify(participant, _soviet, [&](auto &row){
    row.status = "accepted"_n;
    row.is_initial = true;
    row.is_minimum = true;
    row.has_vote = true; 
    row.minimum_amount = minimum;
    row.initial_amount = initial;   
  });
  
};