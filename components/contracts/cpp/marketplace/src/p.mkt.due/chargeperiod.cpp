/**
 * @brief Списание обеспечительной части паевого взноса по строке счётчика
 * пайщика за период (задачи 99D-21 и 99D-33, КЭУ-3; документ «Коэффициент
 * экономического участия», раздел 9).
 *
 * Узел называет только пайщика, участок и период; суммы контракт берёт из
 * своей строки `kudues`: стоимость выданных заказов периода (T_п), их
 * обеспечительную часть к списанию (amount) и удержания при отказе (retained).
 * По ставкам строки итога участка за тот же период:
 *
 *   участку    = T_п × r_ку / H + retained
 *   фонды      = T_п × r_ф  / H
 *   инициатору = T_п × r_и  / H
 *   возврат    = amount − T_п × (r_ку + r_ф + r_и) / H   (остатки округления — пайщику)
 *
 * Если ставка заказов пайщика была ниже ставки прогона и возврат отрицателен,
 * части уменьшаются по порядку: возврат, инициатору, фонды, участку.
 * Строка без стоимости (одни удержания) списывается участку целиком и итога
 * участка не требует.
 *
 * Движения одной транзакцией под хэшем строки (`Marketplace::Dues::charge_hash`),
 * процесс p.mkt.due:
 *  - o.mkt.charge — w.mkt.due → w.mkt.fee на сумму участку + фонды + инициатору;
 *  - o.brn.common — w.mkt.fee → w.brn.common участка, Дт 80 / Кт 86 (branch::accrue);
 *  - o.fnd.indiv / o.fnd.resrv / o.fnd.devel — w.mkt.fee → кошелёк каждого фонда накопления,
 *    Дт 80 / Кт 86 (fund::accrue; кошелёк и есть субсчёт фонда, задача 99D-25);
 *  - доля инициаторов (задача 99D-27): пока паевые взносы участка не возвращены —
 *    o.mkt.repay, w.mkt.fee → w.mkt.repay участка, Дт 80 / Кт 86, и рост
 *    счётчика возврата; доля денег в базе возврата гасит 26 — o.mkt.icover,
 *    Дт 86 / Кт 26, только проводка; сверх непогашенного и без паевых взносов —
 *    o.brn.common на общий кошелёк участка; переплата завершивших возврат —
 *    o.mkt.rpsurp и сторно её денежной доли o.mkt.iuncov (Дт 26 / Кт 86);
 *  - o.mkt.retdue — w.mkt.due → w.mkt.share пайщика, без проводки.
 * Части с нулевой суммой не проводятся. Строка счётчика стирается: повторное
 * списание невозможно — списывать нечего.
 *
 * Guards:
 *  - require_auth(coopname);
 *  - участок существует; строка счётчика есть (MARKETPLACE_DUE_NOT_FOUND);
 *  - период закончился (MARKETPLACE_PERIOD_OPEN);
 *  - по заказам этой строки нет открытого заявления на гарантийный возврат
 *    (MARKETPLACE_DUE_RETURN_PENDING): решение совета вернёт часть с кошелька
 *    и уменьшит строку; заявления по заказам других строк списание не держат;
 *  - у строки со стоимостью есть строка итога участка (MARKETPLACE_PERIOD_NOT_CLOSED);
 *  - остаток w.mkt.due пайщика не меньше суммы строки (MARKETPLACE_DUE_EXCEEDS) —
 *    страховка: счётчики пишутся теми же транзакциями, что и кошелёк.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::chargeperiod(eosio::name coopname, eosio::name username, eosio::name braname,
                               uint32_t period) {
  require_auth(coopname);
  get_branch_or_fail(coopname, braname);

  const auto row_id = Marketplace::Dues::find_member_id(coopname, username, braname, period);
  eosio::check(row_id.has_value(),
               "MARKETPLACE_DUE_NOT_FOUND: У пайщика нет обеспечительной части к списанию на этом участке за этот период");
  eosio::check(period < Marketplace::Dues::current_period(coopname),
               "MARKETPLACE_PERIOD_OPEN: Период списания ещё идёт — строка списывается после его окончания");
  eosio::check(!Marketplace::has_open_return_in_due(coopname, username, braname, period),
               "MARKETPLACE_DUE_RETURN_PENDING: По заказу этого периода открыто заявление на гарантийный возврат — списание после решения совета");

  kudues_index dues(_marketplace, coopname.value);
  const kudue row = dues.get(*row_id);
  const eosio::asset amount = row.due;
  const eosio::asset total = row.due + row.retained;

  const auto due = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SECURE_DUE, username);
  eosio::check(due.available >= total,
               std::string{"MARKETPLACE_DUE_EXCEEDS: К списанию учтено больше, чем лежит на кошельке обеспечительной части: учтено "} +
                 total.to_string() + ", доступно " + due.available.to_string());

  int64_t to_branch = 0;
  int64_t to_funds = 0;
  int64_t to_initiator = 0;
  int64_t to_return = amount.amount;

  if (row.turnover.amount > 0) {
    kuperiods_index periods(_marketplace, coopname.value);
    const kuperiod rates = Marketplace::get_period_or_fail(periods, braname, period);
    const uint128_t H = HUNDR_PERCENTS;
    const auto part = [&](uint64_t rate) -> int64_t {
      return static_cast<int64_t>(static_cast<uint128_t>(row.turnover.amount) * rate / H);
    };
    to_branch = part(rates.rate_branch);
    to_funds = part(rates.rate_funds);
    to_initiator = part(rates.rate_initiator);
    to_return = amount.amount - to_branch - to_funds - to_initiator;

    if (to_return < 0) {
      // Ставка заказов пайщика была ниже ставки прогона: уменьшаем части по
      // порядку — возврат, инициатору, фонды, участку, пока сумма не сойдётся.
      int64_t shortfall = -to_return;
      to_return = 0;
      const auto take = [&](int64_t& from) {
        const int64_t cut = shortfall < from ? shortfall : from;
        from -= cut;
        shortfall -= cut;
      };
      take(to_initiator);
      take(to_funds);
      take(to_branch);
      eosio::check(shortfall == 0,
                   "MARKETPLACE_DUE_AMOUNT_INVALID: Части списания не сходятся с остатком обеспечительной части");
    }
  }
  // Удержания при отказе — участку целиком, в ставки итога не входят.
  to_branch += row.retained.amount;

  const checksum256 hash = Marketplace::Dues::charge_hash(coopname, username, braname, period);
  const int64_t charged = to_branch + to_funds + to_initiator;
  if (charged > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::CHARGE_DUE,
                   processes::marketplace::DUE,
                   eosio::asset(charged, _root_govern_symbol), username, hash,
                   Marketplace::Memo::get_charge_period_memo());
  }
  if (to_branch > 0) {
    Branch::accrue(_marketplace, coopname, braname,
                   eosio::asset(to_branch, _root_govern_symbol),
                   processes::marketplace::DUE, hash,
                   Marketplace::Memo::get_charge_due_distribute_memo());
  }
  if (to_funds > 0) {
    Fund::accrue(_marketplace, coopname,
                 eosio::asset(to_funds, _root_govern_symbol),
                 processes::marketplace::DUE, hash,
                 Marketplace::Memo::get_charge_period_funds_memo());
  }
  if (to_initiator > 0) {
    // Доля инициаторов возмещает их паевые взносы в участок, пока они не
    // возвращены; сверх непогашенного и без паевых взносов — на общий кошелёк
    // участка (инвестиционный этап, задача 99D-27).
    Marketplace::route_initiator_share(_marketplace, coopname, braname,
                                       eosio::asset(to_initiator, _root_govern_symbol), hash);
  }
  if (to_return > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::RETURN_DUE,
                   processes::marketplace::DUE,
                   eosio::asset(to_return, _root_govern_symbol), username, hash,
                   Marketplace::Memo::get_charge_period_return_memo());
  }

  dues.erase(dues.find(*row_id));
}
