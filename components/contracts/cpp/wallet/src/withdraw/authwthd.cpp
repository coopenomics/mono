void wallet::authwthd(AUTHWTHD_SIGNATURE) {
  require_auth(_soviet);
  
  auto exist_withdraw = Wallet::get_withdraw(coopname, hash);
  eosio::check(exist_withdraw.has_value(), "Объект возврата с указанным хэшем не найден");
  
  Wallet::withdraws_index withdraws(_wallet, coopname.value);
  
  auto withdraw = withdraws.find(exist_withdraw -> id);
  eosio::check(withdraw != withdraws.end(), "Объект процессинга не найден");
  
  withdraws.modify(withdraw, RamPayer::of(withdraws, coopname), [&](auto &d){
    d.status = "authorized"_n;
  });
  
  // создаём объект исходящего платежа в gateway с коллбэком после обработки
  Action::send<createoutpay_interface>(
    _gateway,
    "createoutpay"_n,
    _wallet,
    coopname, 
    withdraw -> username, 
    hash, 
    withdraw -> quantity, 
    _wallet, 
    Wallet::get_valid_wallet_action("completewthd"_n), 
    Wallet::get_valid_wallet_action("declinewthd"_n)
  );
}
