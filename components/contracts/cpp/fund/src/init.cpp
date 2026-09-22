/**
 * @brief Инициализация фондов кооператива.
 * Создает кооперативный кошелек и базовые фонды при запуске кооператива.
 * Создает неделимый, резервный, фонд развития кооперации, хозяйственный и фонд взаимного обеспечения.
 * @param coopname Наименование кооператива
 * @param initial Начальная сумма для инициализации фондов
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p _soviet или @p _registrator
 */
[[eosio::action]] void fund::init(eosio::name coopname, eosio::asset initial) {
  eosio::name payer = check_auth_and_get_payer_or_fail({_soviet, _registrator});

  coopwallet_index coopwallet(_fund, coopname.value);

  accfunds_index accfunds(_fund, coopname.value);
  expfunds_index expfunds(_fund, coopname.value);
  
  auto exist = coopwallet.find(0);
  
  if (exist == coopwallet.end()) {  
    // кошелёк кооператива
    coopwallet.emplace(RamPayer::of(coopwallet, coopname), [&](auto &row) {
      row.id = 0;
      row.coopname = coopname;

      row.circulating_account.available = asset(0, initial.symbol);
      row.circulating_account.withdrawed = asset(0, initial.symbol);

      row.initial_account.available = asset(0, initial.symbol);
      row.initial_account.withdrawed = asset(0, initial.symbol);

      row.accumulative_account.available = asset(0, initial.symbol);
      row.accumulative_account.withdrawed = asset(0, initial.symbol);

      row.accumulative_expense_account.available = asset(0, initial.symbol);
      row.accumulative_expense_account.withdrawed = asset(0, initial.symbol);
    });

    // неделимый
    accfunds.emplace(RamPayer::of(accfunds, coopname), [&](auto &a) {
      a.id = get_global_id_in_scope(_fund, coopname, "funds"_n);  // 1
      a.coopname = coopname;
      a.contract = ""_n;
      a.name = "Неделимый фонд";
      a.description = "";
      a.percent = 1 * ONE_PERCENT;
      a.available = asset(0, initial.symbol);
      a.withdrawed = asset(0, initial.symbol);
    });

    // резервный
    accfunds.emplace(RamPayer::of(accfunds, coopname), [&](auto &a) {
      a.id = get_global_id_in_scope(_fund, coopname, "funds"_n);  // 2
      a.coopname = coopname;
      a.contract = ""_n;
      a.name = "Резервный фонд";
      a.description = "";
      a.percent = 15 * ONE_PERCENT;
      a.available = asset(0, initial.symbol);
      a.withdrawed = asset(0, initial.symbol);
    });

    // развития
    accfunds.emplace(RamPayer::of(accfunds, coopname), [&](auto &a) {
      a.id = get_global_id_in_scope(_fund, coopname, "funds"_n);  // 3
      a.coopname = coopname;
      a.contract = ""_n;
      a.name = "Фонд развития кооперации";
      a.description = "";
      a.percent = 5 * ONE_PERCENT;
      a.available = asset(0, initial.symbol);
      a.withdrawed = asset(0, initial.symbol);
    });

    // хозяйственный
    expfunds.emplace(RamPayer::of(expfunds, coopname), [&](auto &e) {
      e.id = get_global_id_in_scope(_fund, coopname, "funds"_n);  // 4
      e.coopname = coopname;
      e.contract = ""_n;
      e.name = "Хозяйственный фонд";
      e.description = "";
      e.expended = asset(0, initial.symbol);
    });

    // взаимный
    expfunds.emplace(RamPayer::of(expfunds, coopname), [&](auto &e) {
      e.id = get_global_id_in_scope(_fund, coopname, "funds"_n);  // 5
      e.coopname = coopname;
      e.contract = ""_n;
      e.name = "Фонд взаимного обеспечения";
      e.description = "";
      e.expended = asset(0, initial.symbol);
    });
  }
}