/**
 * @brief Отменяет процесс возврата средств в контракте `wallet`.
 */
void wallet::declinewthd(eosio::name coopname, checksum256 withdraw_hash, std::string reason) {
  name payer = check_auth_and_get_payer_or_fail({_soviet, _gateway});
  
  auto exist_withdraw = Wallet::get_withdraw(coopname, withdraw_hash);
  eosio::check(exist_withdraw.has_value(), "Объект возврата не найден");
  
  Wallet::withdraws_index withdraws(_wallet, coopname.value);
  auto withdraw = withdraws.find(exist_withdraw -> id);
  
  std::string memo = "Отмена возврата части целевого паевого взноса по программе 'Цифровой Кошелёк' по причине: " + reason;

  // ledger2: UNBLOCK на w.wal.share — снимаем резерв (зеркало REQUEST_WITHDRAW).
  Ledger2::apply(_wallet, coopname, operations::wallet::DECLINE_WITHDRAW,
                 withdraw -> quantity, withdraw -> username, withdraw_hash, memo);

  withdraws.erase(withdraw);
};
