/**
 * @brief Переходное действие (задача 99D-33, п. 6): заказы, выданные до
 * появления счётчиков списания, в счётчики не попали — их суммы лежали в
 * зеркале узла `marketplace_secure_due`. При первом старте после обновления
 * узел переносит каждую незакрытую строку зеркала в счётчик одним вызовом.
 *
 * Суммы здесь называет узел — единственный раз и под потолком контракта: сумма
 * строк пайщика к списанию (по ставкам и удержания вместе) после переноса не
 * может превысить остаток его кошелька `w.mkt.due`. Больше, чем лежит на
 * кошельке, в счётчики не попадёт.
 *
 * Счётчик участка пополняется, только если итог за этот период ещё не
 * рассчитан: у рассчитанного итога ставки зафиксированы, строка пайщика
 * спишется по ним. Период строки узел считает той же функцией, что и контракт
 * (конец гарантийного срока → `Branch::aid_period`).
 *
 * Действие снимается следующим выпуском после переноса.
 *
 * Guards:
 *  - require_auth(coopname);
 *  - участок существует; период задан;
 *  - суммы в валюте кооператива, не меньше нуля; к списанию больше нуля;
 *  - потолок кошелька (MARKETPLACE_DUE_EXCEEDS).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::migratedue(eosio::name coopname, eosio::name username, eosio::name braname,
                             uint32_t period, eosio::asset turnover, eosio::asset due,
                             eosio::asset retained) {
  require_auth(coopname);
  get_branch_or_fail(coopname, braname);

  const auto non_negative = [](const eosio::asset& a) {
    return a.is_valid() && a.amount >= 0 && a.symbol == _root_govern_symbol;
  };
  eosio::check(non_negative(turnover) && non_negative(due) && non_negative(retained),
               "MARKETPLACE_DUE_AMOUNT_INVALID: Суммы переноса не могут быть отрицательными и должны быть в валюте кооператива");
  eosio::check(due.amount + retained.amount > 0,
               "MARKETPLACE_DUE_AMOUNT_INVALID: Переносить нечего — к списанию ноль");
  eosio::check(period > 0, "MARKETPLACE_PERIOD_AMOUNT_INVALID: Номер периода не задан");

  const eosio::asset wallet = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SECURE_DUE, username).available;
  const eosio::asset after = Marketplace::Dues::member_total(coopname, username) + due + retained;
  eosio::check(wallet >= after,
               std::string{"MARKETPLACE_DUE_EXCEEDS: Перенос превышает остаток кошелька обеспечительной части: учтено было бы "} +
                 after.to_string() + ", доступно " + wallet.to_string());

  // Итог периода уже рассчитан — ставки зафиксированы, счётчик участка не нужен.
  kuperiods_index periods(_marketplace, coopname.value);
  const bool closed = periods.get_index<"bybrperiod"_n>().find(combine_ids(braname.value, period)) !=
                      periods.get_index<"bybrperiod"_n>().end();
  if (!closed) {
    kucounters_index counters(_marketplace, coopname.value);
    const uint64_t counter_id = Marketplace::Dues::ensure_counter(coopname, braname, period);
    counters.modify(counters.get(counter_id), RamPayer::of(counters), [&](auto& c) {
      c.turnover += turnover;
      c.secured  += due;
      c.retained += retained;
      if (turnover.amount > 0) c.orders += 1;
    });
  }

  kudues_index dues(_marketplace, coopname.value);
  dues.modify(dues.get(Marketplace::Dues::ensure_member(coopname, username, braname, period)), RamPayer::of(dues), [&](auto& d) {
    d.turnover += turnover;
    d.due      += due;
    d.retained += retained;
    if (turnover.amount > 0) d.orders += 1;
  });
}
