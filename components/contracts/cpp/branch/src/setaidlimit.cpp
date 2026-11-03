/**
 * @brief Потолок резерва социально-экономического обеспечения на одного
 * получателя в месяц (задача 99D-20, КЭУ-2; решение владельца 03.11.2026).
 *
 * Один потолок на все участки кооператива: верхняя граница любой строки
 * резерва (`setreserve`) и, через неё, предел материальной помощи получателя
 * за месяц. Ноль выключает резерв: строки завести нельзя, материальная помощь
 * выплачивается без предела, как до задачи. Потолок применяется при расчёте
 * итога месяца Стола заказов; прошедшие месяцы не пересчитываются.
 *
 * Guards:
 *  - require_auth(coopname) — ставит администратор со своего стола;
 *  - сумма в валюте кооператива и не меньше нуля.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::setaidlimit(eosio::name coopname, eosio::asset limit) {
  require_auth(coopname);

  eosio::check(limit.is_valid() && limit.amount >= 0 && limit.symbol == _root_govern_symbol,
               "BRANCH_AID_LIMIT_INVALID: Потолок резерва должен быть не меньше нуля и в валюте кооператива");

  brnconfig_singleton cfg(_branch, coopname.value);
  auto state = cfg.get_or_default(brnconfig{eosio::asset(0, _root_govern_symbol)});
  state.aid_month_limit = limit;
  cfg.set(state, coopname);
}
