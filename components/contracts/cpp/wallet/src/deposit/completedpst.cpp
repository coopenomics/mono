void wallet::completedpst(eosio::name coopname, checksum256 deposit_hash) {
  require_auth(_gateway);
  
  auto cooperative = get_cooperative_or_fail(coopname);
  
  auto exist_deposit = Wallet::get_deposit(coopname, deposit_hash);
  eosio::check(exist_deposit.has_value(), "Объект паевого взноса не найден");
  
  Wallet::deposits_index deposits(_wallet, coopname.value);
  auto deposit = deposits.find(exist_deposit -> id);
  
  auto participant = get_participant_or_fail(coopname, deposit -> username);

  std::string memo = "Паевой взнос по целевой потребительской программе 'Цифровой Кошелёк' пайщика с username=" + deposit -> username.to_string();

  Ledger2::apply(_wallet, coopname, operations::wallet::COMPLETE_DEPOSIT, deposit -> quantity, deposit -> username, deposit_hash, memo);
  
  //оповещаем пользователя
  require_recipient(deposit -> username);  
  
  deposits.erase(deposit);
}