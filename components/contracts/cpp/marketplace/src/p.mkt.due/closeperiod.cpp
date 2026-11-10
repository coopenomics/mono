/**
 * @brief Расчёт итога периода списания по кооперативному участку (задачи
 * 99D-21 и 99D-33, КЭУ-3; документ «Коэффициент экономического участия»,
 * раздел 8).
 *
 * Стоимость заказов периода (T) и собранную по ним обеспечительную часть (C)
 * контракт берёт из своего счётчика участка `kucounters`: его наполняла выдача
 * (`issueact2`), уменьшали гарантийные возвраты и выход пайщиков. Узел
 * передаёт только факты о расходах, которых в цепи нет. Всё остальное считает
 * контракт.
 *
 * Расходы — по цели резерва (задача 99D-34, решение владельца 10.11.2026):
 * плановые расходы и материальная помощь собираются вперёд, несобранное в
 * месяце с дефицитом переходит дальше, траты из средств инициаторов в расходы
 * не входят — их возмещает компенсация инициаторам. Факты узла:
 *   ПО  — оплачено по плану с общего кошелька за месяц (planned)
 *   СЗ  — служебные записки сверх плана с общего кошелька (memos)
 *   МП  — материальная помощь с персонального кошелька за месяц (aid_paid)
 *   ЦП  — цель плановых расходов: неоплаченные и не запущенные в оплату записи
 *         реестра планов со сроком до конца следующего месяца (planned_target)
 * Контракт:
 *   ЦМ   = Σ накопленного права получателей помощи участка на следующий
 *          период (branch::reserves, право копится и не сгорает)
 *   T    = ЦП + ЦМ                           цель резерва участка
 *   F_пр = собранная часть цели прошлой строки участка; нет строки — 0
 *   РК   = max(0, ПО + СЗ + МП + T − F_пр)   расходы участка за месяц
 *   У    = min(C, РК)                        участку на расходы — первыми (решение владельца 03.11.2026)
 *   Д    = РК − У                            дефицит расходов
 *   F    = max(0, T − Д)                     собранная часть цели: траты месяца
 *                                            покрываются первыми, цель — последней
 *   p, Ф, М, Э, И, В, ставки — как раньше:
 *   Ф    = (C − У) × p / H,  М = У + Ф,  Э = C − У − Ф,  И = Э × φи / H,  В = Э − И
 *   r_ку = У × H / T, r_ф = Ф × H / T, r_и = И × H / T   (T — стоимость заказов; ноль — ставки ноль)
 * Месяц без выданных заказов (счётчика участка нет) тоже получает строку:
 * C = 0, расходы целиком — дефицит, цель переходит дальше несобранной.
 *
 * Старый узел (без planned_target) считается по прежней формуле: резерв
 * помощи — сумма строк резерва, минус невыплаченная часть прошлого резерва;
 * месяц без заказов отклоняется. Ветка живёт до выкладки нового узла.
 * Целочисленная арифметика в единицах актива, промежуточные значения в
 * uint128_t, деление вниз. Остатки округления по каждой строке пайщика
 * достаются пайщику (см. chargeperiod). Строка — основание списания для
 * пайщиков, после записи не меняется; повторный расчёт того же периода
 * отклоняется. Счётчик участка расчётом стирается.
 *
 * Границы: действие читает единицы строк (счётчик участка, резервы участка,
 * фонды кооператива, строки прогонов участка — не больше двух) и не хранит
 * истории.
 *
 * Guards:
 *  - require_auth(coopname) — узел от имени кооператива;
 *  - участок существует;
 *  - период закончился (MARKETPLACE_PERIOD_OPEN);
 *  - старый узел: у участка за период есть выданные заказы с обеспечительной
 *    частью (MARKETPLACE_PERIOD_EMPTY);
 *  - ПО, СЗ, МП, ЦП — не меньше нуля, в валюте кооператива;
 *  - строки за этот период у участка ещё нет (MARKETPLACE_PERIOD_EXISTS);
 *  - сумма процентов фондов не выше 100 %.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::closeperiod(eosio::name coopname, eosio::name braname, uint32_t period,
                              eosio::asset planned, eosio::asset memos, eosio::asset aid_paid,
                              eosio::binary_extension<eosio::asset> planned_target) {
  require_auth(coopname);

  auto branch = get_branch_or_fail(coopname, braname);

  const auto non_negative = [](const eosio::asset& a) {
    return a.is_valid() && a.amount >= 0 && a.symbol == _root_govern_symbol;
  };
  // Новый узел передаёт цель плановых расходов; без неё — прежняя формула.
  const bool by_target = planned_target.has_value();
  eosio::check(non_negative(planned) && non_negative(memos) && non_negative(aid_paid) &&
                 (!by_target || non_negative(planned_target.value())),
               "MARKETPLACE_PERIOD_AMOUNT_INVALID: Расходы участка не могут быть отрицательными и должны быть в валюте кооператива");
  eosio::check(period > 0, "MARKETPLACE_PERIOD_AMOUNT_INVALID: Номер периода не задан");
  eosio::check(period < Marketplace::Dues::current_period(coopname),
               "MARKETPLACE_PERIOD_OPEN: Период списания ещё идёт — итог участка считается после его окончания");

  kuperiods_index periods(_marketplace, coopname.value);
  {
    auto idx = periods.get_index<"bybrperiod"_n>();
    eosio::check(idx.find(combine_ids(braname.value, period)) == idx.end(),
                 "MARKETPLACE_PERIOD_EXISTS: Итог участка за период уже рассчитан");
  }

  // T и C — из счётчика участка: выдано за период минус возвращённое по гарантии
  // и минус строки вышедших пайщиков (их остаток списан при выходе целиком).
  // Месяц без выданных заказов по новой формуле тоже получает строку — с нулями.
  const auto counter_id = Marketplace::Dues::find_counter_id(coopname, braname, period);
  eosio::check(by_target || counter_id.has_value(),
               "MARKETPLACE_PERIOD_EMPTY: За период на участке нет выданных заказов с обеспечительной частью — итог не считается");
  kucounters_index counters(_marketplace, coopname.value);
  eosio::asset turnover(0, _root_govern_symbol);
  eosio::asset secured(0, _root_govern_symbol);
  if (counter_id.has_value()) {
    const kucounter counter = counters.get(*counter_id);
    turnover = counter.turnover;
    secured = counter.secured;
    eosio::check(by_target || turnover.amount > 0,
                 "MARKETPLACE_PERIOD_EMPTY: За период на участке нет выданных заказов с обеспечительной частью — итог не считается");
  }

  // Прошлая строка участка — с наибольшим периодом меньше текущего. Строк у
  // участка не больше двух: delperiod стирает позапрошлые.
  eosio::asset reserve_prev(0, _root_govern_symbol);
  eosio::asset funded_prev(0, _root_govern_symbol);
  {
    auto bybranch = periods.get_index<"bybranch"_n>();
    uint32_t best = 0;
    for (auto it = bybranch.lower_bound(braname.value);
         it != bybranch.end() && it->braname == braname; ++it) {
      if (it->period < period && it->period > best) {
        best = it->period;
        reserve_prev = it->aid_reserve;
        // Строка до 99D-34 собранной части цели не знает: её резерв помощи
        // считался собранным целиком.
        funded_prev = it->target_funded.has_value() ? it->target_funded.value() : it->aid_reserve;
      }
    }
  }

  eosio::asset reserve(0, _root_govern_symbol);
  eosio::asset unpaid(0, _root_govern_symbol);
  eosio::asset target(0, _root_govern_symbol);
  int64_t expenses_amount = 0;
  if (by_target) {
    // Право получателей — на период, следующий за рассчитываемым: его помощь
    // собирается этим итогом.
    reserve = Branch::sum_outstanding(coopname, braname, period + 1);
    target = planned_target.value() + reserve;
    expenses_amount = planned.amount + memos.amount + aid_paid.amount + target.amount - funded_prev.amount;
  } else {
    reserve = Branch::sum_reserves(coopname, braname);
    unpaid = reserve_prev > aid_paid ? reserve_prev - aid_paid : eosio::asset(0, _root_govern_symbol);
    expenses_amount = planned.amount + memos.amount + reserve.amount - unpaid.amount;
  }
  if (expenses_amount < 0) expenses_amount = 0;
  const eosio::asset expenses(expenses_amount, _root_govern_symbol);

  // Проценты фондов накопления кооператива — из реестра фондов (`funds`
  // контракта fund), единственной точкой чтения в shared lib (задача 99D-25).
  const uint64_t funds_percent = Fund::accumulation_percent_sum(coopname);
  eosio::check(funds_percent <= HUNDR_PERCENTS,
               "MARKETPLACE_PERIOD_FUNDS_INVALID: Сумма процентов фондов накопления не может быть выше 100%");

  // Порядок по решению владельца 03.11.2026: сначала расходы участка, из
  // остатка — проценты фондов накопления, остаток — экономия инициатора и пайщиков.
  const uint128_t H = HUNDR_PERCENTS;
  const int64_t branch_amount = expenses.amount < secured.amount ? expenses.amount : secured.amount;
  const int64_t deficit_amount = expenses.amount - branch_amount;
  const int64_t after_expenses = secured.amount - branch_amount;
  const int64_t funds_amount = static_cast<int64_t>(static_cast<uint128_t>(after_expenses) * funds_percent / H);
  const int64_t membership_amount = branch_amount + funds_amount;
  const int64_t economy_amount = after_expenses - funds_amount;
  const uint64_t initiator_percent = Marketplace::get_initiator_share_percent(coopname);
  const int64_t initiator_amount = static_cast<int64_t>(static_cast<uint128_t>(economy_amount) * initiator_percent / H);
  const int64_t return_amount = economy_amount - initiator_amount;

  const auto rate = [&](int64_t part) -> uint64_t {
    if (turnover.amount <= 0) return 0;
    return static_cast<uint64_t>(static_cast<uint128_t>(part) * H / static_cast<uint128_t>(turnover.amount));
  };
  // Собранная часть цели: собранное идёт сначала на траты месяца, цель — последней.
  const int64_t funded_amount = target.amount > deficit_amount ? target.amount - deficit_amount : 0;

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
    if (by_target) {
      row.planned_target = planned_target.value();
      row.target = target;
      row.target_prev = funded_prev;
      row.target_funded = eosio::asset(funded_amount, _root_govern_symbol);
    }
  });

  // Ставки зафиксированы — счётчик участка отработал. Строки пайщиков периода
  // остаются до своего списания по этим ставкам.
  if (counter_id.has_value()) counters.erase(counters.find(*counter_id));
}
