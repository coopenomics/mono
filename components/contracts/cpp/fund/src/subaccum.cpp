[[eosio::action]] void fund::subaccum(eosio::name coopname, uint64_t fund_id,
                                      eosio::asset quantity) {
  // списать можно только с помощью вызова метода withdraw смарт-контракта
  require_auth(_fund);

  coopwallet_index coopwallet(_fund, coopname.value);
  auto wal = coopwallet.find(0);
  eosio::check(wal != coopwallet.end(), "Фондовый кошелёк не найден");
  eosio::check(wal->accumulative_account.available >= quantity,
               "Недостаточно средств для списания");

  coopwallet.modify(wal, RamPayer::of(coopwallet, coopname), [&](auto &row) {
    row.accumulative_account.available -= quantity;
    row.accumulative_account.withdrawed += quantity;
  });

  accfunds_index accfunds(_fund, coopname.value);
  auto afund = accfunds.find(fund_id);

  eosio::check(afund != accfunds.end(), "Фонд не найден");

  accfunds.modify(afund, RamPayer::of(accfunds, coopname), [&](auto &a) {
    a.available -= quantity;
    a.withdrawed += quantity;
  });
};
