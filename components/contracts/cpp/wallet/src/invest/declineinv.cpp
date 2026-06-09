/**
 * @brief Отменяет процесс инвестирования средств кооператива в ЦПП
 * оператора платформы (отказ совета либо отказ кассира в gateway).
 * Учётных операций нет: резервирование на этапе заявки не выполнялось,
 * средства расчётного счёта (51) не имеют wallet-зеркала в ledger2.
 */
void wallet::declineinv(eosio::name coopname, checksum256 invest_hash, std::string reason) {
  name payer = check_auth_and_get_payer_or_fail({_soviet, _gateway});

  auto exist_investment = Wallet::get_investment(coopname, invest_hash);
  eosio::check(exist_investment.has_value(), "Объект инвестирования не найден");

  Wallet::investments_index investments(_wallet, coopname.value);
  auto investment = investments.find(exist_investment -> id);

  investments.erase(investment);
};
