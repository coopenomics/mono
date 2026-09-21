/**
 * @brief Атомарный метод списания вступительного взноса. Используется только при отмене операции вступления.
 * 
 * @param coopname
 * @param quantity 
 */
[[eosio::action]] void fund::subinitial(eosio::name coopname,
                                        eosio::asset quantity) {
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  auto cooperative = get_cooperative_or_fail(coopname);

  coopwallet_index coopwallet(_fund, coopname.value);
  auto wal = coopwallet.find(0);
  
  coopwallet.modify(
      wal, RamPayer::of(coopwallet, coopname), [&](auto &row) { row.initial_account.available -= quantity; });
}
