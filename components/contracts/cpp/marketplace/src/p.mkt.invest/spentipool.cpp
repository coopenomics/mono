/**
 * @brief Расход из пула инициаторов оплачен (задача 99D-27; вызывает контракт
 * branch по завершении записки и выплате помощи, ИНВ-2). Сами деньги
 * списывает шасси расходов или выплата помощи (Дт 26 / Кт 51); здесь
 * израсходованное распределяется по инициаторам и входит в базу возврата.
 *
 * Деньги расходуются по очереди входа инициаторов в участок (индекс
 * `byunused`): сначала деньги первого, затем следующего. Перебор идёт только
 * по тем, чьи деньги расходуются этим вызовом.
 *
 * Guards: авторизация контракта branch; резерв участка не меньше суммы.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::spentipool(eosio::name coopname, eosio::name braname, eosio::asset amount,
                             checksum256 hash) {
  require_auth(_branch);
  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "MARKETPLACE_IPOOL_AMOUNT_INVALID: Сумма расхода должна быть больше нуля и в валюте кооператива");
  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto bit = branches.find(braname.value);
  eosio::check(bit != branches.end() && bit->reserved >= amount,
               "MARKETPLACE_IPOOL_RESERVE_EXCEEDED: Расход больше выделенного под расходы участка");

  mkt_invbranch b = *bit;
  b.reserved    -= amount;
  b.spent_total += amount;

  mkt_investors_index investors(_marketplace, coopname.value);
  auto by_unused = investors.get_index<"byunused"_n>();
  const uint128_t from = combine_ids(braname.value, 0);
  const uint128_t upto = combine_ids(braname.value, MarketInvest::OUT_OF_RANGE);
  int64_t rest = amount.amount;
  while (rest > 0) {
    auto it = by_unused.lower_bound(from);
    eosio::check(it != by_unused.end() && it->by_unused() < upto,
                 "MARKETPLACE_IPOOL_UNBACKED: Израсходовано больше, чем внесли инициаторы участка");
    mkt_investor row = *it;
    const int64_t take = rest < row.unused() ? rest : row.unused();
    MarketInvest::leave_base(b, row);
    row.used_money.amount += take;
    b.unused_total.amount -= take;
    MarketInvest::enter_base(b, row);
    by_unused.modify(it, RamPayer::of(investors, coopname), [&](auto& x) { x = row; });
    rest -= take;
  }

  branches.modify(bit, RamPayer::of(branches, coopname), [&](auto& x) { x = b; });
}
