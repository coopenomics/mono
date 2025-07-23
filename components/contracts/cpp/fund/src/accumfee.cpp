/**
 * @brief Атомарный метод добавления членского взноса на накопительный счет кооператива.
 * Минует процесс spreadamount и добавляет средства напрямую на accumulative_expense_account
 * для дальнейшего управления кооперативом (распределение по фондам или использование на расходы).
 * 
 * @param coopname Имя кооператива
 * @param quantity Сумма членского взноса
 */
[[eosio::action]] void fund::accumfee(eosio::name coopname, eosio::asset quantity) {
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  auto cooperative = get_cooperative_or_fail(coopname);

  coopwallet_index coopwallet(_fund, coopname.value);
  auto wal = coopwallet.find(0);
  
  eosio::check(wal != coopwallet.end(), "Кошелёк кооператива не найден");

  // Добавление членского взноса на накопительный счет кооператива
  coopwallet.modify(wal, payer, [&](auto &w) {
    w.accumulative_expense_account.available += quantity;
  });
} 