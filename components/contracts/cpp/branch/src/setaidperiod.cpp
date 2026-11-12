/**
 * @brief Длина периода, за который считается предел материальной помощи
 * (резерв социально-экономического обеспечения), секунд (решение владельца
 * 09.11.2026).
 *
 * Ноль — календарный месяц UTC: так работает кооператив. Стенд со сжатым
 * временем ставит длину своего месяца (`STAND_MONTH_SECONDS`): иначе резерв
 * получателя обновлялся бы раз в настоящий месяц, а итоги месяцев Стола
 * заказов — каждые несколько минут, и проверить помесячный предел было бы
 * нельзя. Ставит узел кооператива при запуске; потолок резерва не меняется.
 *
 * Guards:
 *  - require_auth(coopname);
 *  - ноль либо не меньше минуты (BRANCH_AID_PERIOD_INVALID).
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::setaidperiod(eosio::name coopname, uint32_t seconds) {
  require_auth(coopname);

  eosio::check(seconds == 0 || seconds >= 60,
               "BRANCH_AID_PERIOD_INVALID: Длина периода материальной помощи — ноль (календарный месяц) либо не меньше минуты");

  brnconfig_singleton cfg(_branch, coopname.value);
  auto state = cfg.get_or_default(brnconfig{eosio::asset(0, _root_govern_symbol)});
  state.aid_period_seconds = seconds;
  cfg.set(state, coopname);
}
