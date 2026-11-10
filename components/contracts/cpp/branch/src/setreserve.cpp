/**
 * @brief Резерв социально-экономического обеспечения получателя на участке
 * (задача 99D-20, КЭУ-2; решение владельца 03.11.2026).
 *
 * Председатель участка записывает сумму материальной помощи в месяц по
 * каждому получателю — себе и доверенным лицам. Суммы произвольные, по сменам
 * и договорённости; усреднения нет. Строка создаётся или перезаписывается.
 * Сумма строки — начисление права получателя на материальную помощь за каждый
 * период: право копится и не сгорает (задача 99D-34), его предел проверяет
 * `createaid`. Накопленное право получателей участка — слагаемое цели резерва
 * в расчёте итога месяца Стола заказов.
 *
 * Авторизация как у `setweight`: действие подаёт кооператив, роль
 * председателя участка проверяет ИСТОК до отправки.
 *
 * Guards:
 *  - потолок резерва включён (`brnconfig.aid_month_limit > 0`);
 *  - участок существует; получатель — председатель либо доверенное лицо участка;
 *  - сумма в валюте кооператива, больше нуля и не выше потолка.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::setreserve(eosio::name coopname, eosio::name braname,
                                           eosio::name username, eosio::asset amount) {
  check_auth_or_fail(_branch, coopname, coopname, "setreserve"_n);

  const eosio::asset limit = Branch::aid_month_limit(coopname);
  eosio::check(limit.amount > 0,
               "BRANCH_RESERVE_DISABLED: Потолок резерва социально-экономического обеспечения не задан администратором");

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(username),
               "BRANCH_RESERVE_NOT_TRUSTED: Резерв можно задать только председателю или доверенному лицу участка");

  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "BRANCH_RESERVE_AMOUNT_INVALID: Резерв должен быть больше нуля и в валюте кооператива");
  eosio::check(amount <= limit,
               std::string{"BRANCH_RESERVE_OVER_LIMIT: Резерв получателя выше потолка кооператива: заявлено "} +
                 amount.to_string() + ", потолок " + limit.to_string());

  branch_reserves_index reserves(_branch, coopname.value);
  auto idx = reserves.get_index<"bybruser"_n>();
  auto it = idx.find(combine_ids(braname.value, username.value));
  // Накопленное право (задача 99D-34): новая строка начисляет право текущего
  // периода сразу; у прежней право сначала доначисляется по старой сумме по
  // текущий период включительно, новая сумма действует со следующего.
  const uint32_t period = Branch::aid_period(coopname, eosio::time_point_sec(eosio::current_time_point()));
  if (it == idx.end()) {
    reserves.emplace(RamPayer::of(reserves, coopname), [&](auto &r) {
      r.id = reserves.available_primary_key();
      r.braname = braname;
      r.username = username;
      r.amount = amount;
      r.accrued_period = period;
      r.outstanding = amount;
    });
  } else {
    const eosio::asset available = Branch::outstanding_of(coopname, *it, period);
    idx.modify(it, RamPayer::of(idx, coopname), [&](auto &r) {
      r.amount = amount;
      r.accrued_period = period;
      r.outstanding = available;
    });
  }
}
