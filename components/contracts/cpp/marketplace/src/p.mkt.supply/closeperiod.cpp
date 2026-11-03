/**
 * @brief Расчёт итога прогона списания по кооперативному участку (задача
 * 99D-21, КЭУ-3; документ «Коэффициент экономического участия», раздел 8).
 *
 * ИСТОК первого числа отбирает заказы участка с истёкшим гарантийным сроком и
 * передаёт пять фактов: стоимость этих заказов (T), собранную по ним
 * обеспечительную часть (C), плановые расходы (ПР), служебные записки сверх
 * плана (СЗ) и выплаченную материальную помощь (МП) за закончившийся месяц.
 * Всё остальное считает контракт:
 *
 *   Р    = Σ резерва социально-экономического обеспечения пайщиков участка (branch::reserves)
 *   Р_пр = резерв прошлого прогона участка (его строка kuperiods); нет строки — 0
 *   Н    = max(0, Р_пр − МП)                 невыплаченная часть прошлого резерва
 *   РК   = max(0, ПР + СЗ + Р − Н)           расходы участка за прогон
 *   p    = Σ процентов фондов накопления (fund::accfunds)
 *   М    = min(C, РК × H / (H − p))          членский взнос участка; фонды удерживаются первыми
 *   Ф    = М × p / H                         в фонды накопления
 *   У    = М − Ф                             участку на расходы
 *   Д    = max(0, РК − У)                    дефицит
 *   Э    = C − М                             экономия
 *   И    = Э × φи / H                        инициатору
 *   В    = Э − И                             пайщикам обратно
 *   r_ку = У × H / T, r_ф = Ф × H / T, r_и = И × H / T   ставки прогона
 *
 * Целочисленная арифметика в единицах актива, промежуточные значения в
 * uint128_t, деление вниз. Остатки округления по каждому заказу достаются
 * пайщику (см. chargeperiod). Строка — основание списания для пайщиков, после
 * записи не меняется; повторный расчёт того же периода отклоняется.
 *
 * Границы: действие читает единицы строк (резервы участка, фонды кооператива,
 * строки прогонов участка — не больше двух) и не хранит истории.
 *
 * Guards:
 *  - require_auth(coopname) — ИСТОК от имени кооператива;
 *  - участок существует;
 *  - T и C в валюте кооператива и больше нуля; ПР, СЗ, МП — не меньше нуля;
 *  - строки за этот период у участка ещё нет;
 *  - сумма процентов фондов меньше 100 %.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::closeperiod(eosio::name coopname, eosio::name braname, uint32_t period,
                              eosio::asset turnover, eosio::asset secured,
                              eosio::asset planned, eosio::asset memos, eosio::asset aid_paid) {
  require_auth(coopname);

  auto branch = get_branch_or_fail(coopname, braname);

  const auto positive = [](const eosio::asset& a) {
    return a.is_valid() && a.amount > 0 && a.symbol == _root_govern_symbol;
  };
  const auto non_negative = [](const eosio::asset& a) {
    return a.is_valid() && a.amount >= 0 && a.symbol == _root_govern_symbol;
  };
  eosio::check(positive(turnover) && positive(secured),
               "MARKETPLACE_PERIOD_AMOUNT_INVALID: Стоимость заказов и собранная обеспечительная часть прогона должны быть больше нуля и в валюте кооператива");
  eosio::check(non_negative(planned) && non_negative(memos) && non_negative(aid_paid),
               "MARKETPLACE_PERIOD_AMOUNT_INVALID: Расходы участка не могут быть отрицательными и должны быть в валюте кооператива");
  eosio::check(period > 0, "MARKETPLACE_PERIOD_AMOUNT_INVALID: Номер периода не задан");

  kuperiods_index periods(_marketplace, coopname.value);
  {
    auto idx = periods.get_index<"bybrperiod"_n>();
    eosio::check(idx.find(combine_ids(braname.value, period)) == idx.end(),
                 "MARKETPLACE_PERIOD_EXISTS: Итог участка за период уже рассчитан");
  }

  // Резерв прошлого прогона — строка участка с наибольшим периодом меньше текущего.
  eosio::asset reserve_prev(0, _root_govern_symbol);
  {
    auto bybranch = periods.get_index<"bybranch"_n>();
    uint32_t best = 0;
    for (auto it = bybranch.lower_bound(braname.value);
         it != bybranch.end() && it->braname == braname; ++it) {
      if (it->period < period && it->period > best) {
        best = it->period;
        reserve_prev = it->aid_reserve;
      }
    }
  }

  const eosio::asset reserve = Branch::sum_reserves(coopname, braname);
  const eosio::asset unpaid = reserve_prev > aid_paid ? reserve_prev - aid_paid
                                                      : eosio::asset(0, _root_govern_symbol);
  int64_t expenses_amount = planned.amount + memos.amount + reserve.amount - unpaid.amount;
  if (expenses_amount < 0) expenses_amount = 0;
  const eosio::asset expenses(expenses_amount, _root_govern_symbol);

  // Проценты фондов накопления кооператива — из контракта фондов.
  uint64_t funds_percent = 0;
  {
    accfunds_index accfunds(_fund, coopname.value);
    for (auto it = accfunds.begin(); it != accfunds.end(); ++it) funds_percent += it->percent;
  }
  eosio::check(funds_percent < HUNDR_PERCENTS,
               "MARKETPLACE_PERIOD_FUNDS_INVALID: Сумма процентов фондов накопления не может быть 100% и выше");

  const uint128_t H = HUNDR_PERCENTS;
  const uint128_t cap = static_cast<uint128_t>(expenses.amount) * H / (H - funds_percent);
  const int64_t membership_amount = cap < static_cast<uint128_t>(secured.amount)
    ? static_cast<int64_t>(cap) : secured.amount;
  const int64_t funds_amount = static_cast<int64_t>(static_cast<uint128_t>(membership_amount) * funds_percent / H);
  const int64_t branch_amount = membership_amount - funds_amount;
  const int64_t deficit_amount = expenses.amount > branch_amount ? expenses.amount - branch_amount : 0;
  const int64_t economy_amount = secured.amount - membership_amount;
  const uint64_t initiator_percent = Marketplace::get_initiator_share_percent(coopname);
  const int64_t initiator_amount = static_cast<int64_t>(static_cast<uint128_t>(economy_amount) * initiator_percent / H);
  const int64_t return_amount = economy_amount - initiator_amount;

  const auto rate = [&](int64_t part) -> uint64_t {
    return static_cast<uint64_t>(static_cast<uint128_t>(part) * H / static_cast<uint128_t>(turnover.amount));
  };

  periods.emplace(RamPayer::of(periods, coopname), [&](auto& row) {
    row.id = periods.available_primary_key();
    row.braname = braname;
    row.period = period;
    row.turnover = turnover;
    row.secured = secured;
    row.planned = planned;
    row.memos = memos;
    row.aid_paid = aid_paid;
    row.aid_reserve = reserve;
    row.aid_unpaid = unpaid;
    row.expenses = expenses;
    row.membership = eosio::asset(membership_amount, _root_govern_symbol);
    row.funds_amount = eosio::asset(funds_amount, _root_govern_symbol);
    row.branch_amount = eosio::asset(branch_amount, _root_govern_symbol);
    row.initiator_amount = eosio::asset(initiator_amount, _root_govern_symbol);
    row.return_amount = eosio::asset(return_amount, _root_govern_symbol);
    row.deficit = eosio::asset(deficit_amount, _root_govern_symbol);
    row.rate_branch = rate(branch_amount);
    row.rate_funds = rate(funds_amount);
    row.rate_initiator = rate(initiator_amount);
    row.initiator = Marketplace::initiator_of(coopname, braname, branch.trustee);
    row.closed_at = eosio::time_point_sec(eosio::current_time_point());
  });
}
