// фонды списания
[[eosio::action]] void fund::addexpense(eosio::name coopname, uint64_t fund_id,
                                        eosio::asset quantity) {
  require_auth(_fund);

  coopwallet_index coopwallet(_fund, coopname.value);
  auto wal = coopwallet.find(0);

  eosio::check(wal != coopwallet.end(), "Фондовый кошелёк не найден");

  eosio::check(wal->accumulative_expense_account.available +
                       wal->initial_account.available >=
                   quantity,
               "Недостаточно средств для списания");

  coopwallet.modify(wal, RamPayer::of(coopwallet, coopname), [&](auto &w) {

    /**
     * @brief проверить что списание идет по хозяйственному фонду
      если да - уменьшить счет членских взносов автоматически на всю возможную
      сумму. Остаток снять с накопительного счета списания.
     */
    if (fund_id == 4) {
  
      // Списываем из initial_account
      eosio::asset from_initial =
          std::min(quantity, w.initial_account.available);
      w.initial_account.available -= from_initial;
      w.initial_account.withdrawed += from_initial;

      // Если осталось списание, снимаем с accumulative_expense_account
      eosio::asset remaining = quantity - from_initial;
      if (remaining.amount > 0) {
        w.accumulative_expense_account.available -= remaining;
        w.accumulative_expense_account.withdrawed += remaining;
      }
    } else {
      w.accumulative_expense_account.available -= quantity;
      w.accumulative_expense_account.withdrawed += quantity;
    }
  });

  expfunds_index expfunds(_fund, coopname.value);
  auto efund = expfunds.find(fund_id);

  eosio::check(efund != expfunds.end(), "Фонд не найден");

  expfunds.modify(efund, RamPayer::of(expfunds, coopname), [&](auto &a) { a.expended += quantity; });
};
