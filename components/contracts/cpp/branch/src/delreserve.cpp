/**
 * @brief Снять резерв социально-экономического обеспечения получателя на
 * участке (задача 99D-20, КЭУ-2).
 *
 * Строка стирается; поданные в этом месяце заявления на материальную помощь
 * остаются как есть, новые заявления получателя отклоняются до новой строки.
 * Авторизация как у `setreserve`: кооператив подаёт, роль председателя
 * проверяет ИСТОК.
 *
 * Guards:
 *  - участок существует;
 *  - строка резерва получателя есть.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::delreserve(eosio::name coopname, eosio::name braname,
                                           eosio::name username) {
  check_auth_or_fail(_branch, coopname, coopname, "delreserve"_n);
  get_branch_or_fail(coopname, braname);

  bool found = false;
  Branch::reserve_of(coopname, braname, username, found);
  eosio::check(found, "BRANCH_RESERVE_NOT_FOUND: У получателя нет резерва на этом участке");

  Branch::erase_reserves(coopname, braname, username);
}
