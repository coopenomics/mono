// фонды накопления
[[eosio::action]] void fund::addaccum(eosio::name coopname, uint64_t fund_id,
                                      eosio::asset quantity) {
  require_auth(_fund);

  coopwallet_index coopwallet(_fund, coopname.value);
  auto wal = coopwallet.find(0);
  eosio::check(wal != coopwallet.end(), "Кошелёк кооператива не найден");

  coopwallet.modify(wal, RamPayer::of(coopwallet, coopname), [&](auto &row) {
    row.accumulative_account.available += quantity;
  });

  accfunds_index accfunds(_fund, coopname.value);
  auto afund = accfunds.find(fund_id);

  eosio::check(afund != accfunds.end(), "Фонд не найден");

  accfunds.modify(afund, RamPayer::of(accfunds, coopname), [&](auto &a) { a.available += quantity; });
};

