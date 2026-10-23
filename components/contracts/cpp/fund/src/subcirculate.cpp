[[eosio::action]] void fund::subcirculate(
    eosio::name coopname,
    eosio::asset quantity,
    bool skip_available_check
    )  /// < списать сумму из паевого фонда
{
  // Только контракт шлюза или маркетплейса может списывать оборотные средства из фонда
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  auto cooperative = get_cooperative_or_fail(coopname);

  coopwallet_index coopwallet(_fund, coopname.value);

  auto wal = coopwallet.find(0);

  eosio::check(wal != coopwallet.end(), "Фондовый кошелёк не найден");
  
  if (!skip_available_check)
    eosio::check(wal->circulating_account.available >= quantity,
                "Недостаточно средств для списания на паевом счете кооператива");

  coopwallet.modify(wal, RamPayer::of(coopwallet, coopname), [&](auto &w) {
    w.circulating_account.available -= quantity;
    w.circulating_account.withdrawed += quantity;
  });
};
