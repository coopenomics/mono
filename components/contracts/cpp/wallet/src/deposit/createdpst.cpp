void wallet::createdpst(eosio::name coopname, eosio::name username, checksum256 deposit_hash, eosio::asset quantity) {
  require_auth(coopname);
  
  Wallet::validate_asset(quantity);
  
  auto cooperative = get_cooperative_or_fail(coopname);
  auto participant = get_active_participant_or_fail(coopname, username);
  
  Wallet::deposits_index deposits(_wallet, coopname.value);
  auto id = get_global_id_in_scope(_wallet, coopname, "deposits"_n);
  
  auto exist_deposit = Wallet::get_deposit(coopname, deposit_hash);
  eosio::check(!exist_deposit.has_value(), "Взнос у указанным deposit_hash уже существует");
  
  deposits.emplace(coopname, [&](auto &w){
    w.id = id;
    w.coopname = coopname; 
    w.username = username; 
    w.deposit_hash = deposit_hash;       
    w.quantity = quantity;
    w.status = "pending"_n;
  });
  
  // создаём объект исходящего платежа в gateway с коллбэком после обработки
  action(permission_level{ _wallet, "active"_n}, _gateway, "createinpay"_n,
    std::make_tuple(
      coopname, 
      username, 
      deposit_hash, 
      quantity,
      _wallet, 
      "completedpst"_n, 
      "declinedpst"_n
    )
  ).send();
};