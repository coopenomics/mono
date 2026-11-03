/**
 * @brief Списание обеспечительной части паевого взноса по ставкам прогона
 * участка (задача 99D-21, КЭУ-3; документ «Коэффициент экономического участия»,
 * раздел 9).
 *
 * После `closeperiod` ИСТОК по каждому заказу прогона передаёт три факта:
 * остаток обеспечительной части заказа (`amount`), стоимость заказа (`base`) и
 * номер прогона. Контракт делит `amount` по ставкам строки прогона:
 *
 *   участку    = base × r_ку / H
 *   фонды      = base × r_ф  / H
 *   инициатору = base × r_и  / H
 *   возврат    = amount − участку − фонды − инициатору   (остатки округления — пайщику)
 *
 * Если ставка заказа была ниже ставки прогона и возврат отрицателен, части
 * уменьшаются по порядку: возврат, инициатору, фонды, участку.
 *
 * Движения одной транзакцией под хэшем заказа, процесс p.mkt.supply:
 *  - o.mkt.charge — w.mkt.due → w.mkt.fee на сумму участку + фонды + инициатору;
 *  - o.brn.common — w.mkt.fee → w.brn.common участка, Дт 80 / Кт 86 (branch::accrue);
 *  - o.fnd.indiv / o.fnd.resrv / o.fnd.devel — w.mkt.fee → кошелёк каждого фонда накопления,
 *    Дт 80 / Кт 86 (fund::accrue; кошелёк и есть субсчёт фонда, задача 99D-25);
 *  - o.mkt.initr  — w.mkt.fee → w.mkt.invest инициатора из строки прогона, без проводки;
 *  - o.mkt.retdue — w.mkt.due → w.mkt.share пайщика, без проводки.
 * Части с нулевой суммой не проводятся.
 *
 * Прежнее `chargedue` остаётся для удержаний при отказе и остатков при выходе
 * (вся сумма участку): прежний ИСТОК после обновления контрактов зовёт его
 * без ошибок.
 *
 * Guards:
 *  - require_auth(coopname);
 *  - amount и base в валюте кооператива и больше нуля;
 *  - участок существует; строка прогона есть;
 *  - остаток w.mkt.due пайщика не меньше amount.
 *
 * Заказ по `order_hash` не ищется: к моменту списания он может быть стёрт.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::chargeperiod(eosio::name coopname, eosio::name username, eosio::name braname,
                               checksum256 order_hash, eosio::asset amount, eosio::asset base,
                               uint32_t period) {
  require_auth(coopname);

  const auto positive = [](const eosio::asset& a) {
    return a.is_valid() && a.amount > 0 && a.symbol == _root_govern_symbol;
  };
  eosio::check(positive(amount) && positive(base),
               "MARKETPLACE_DUE_AMOUNT_INVALID: Сумма списания и стоимость заказа должны быть больше нуля и в валюте кооператива");
  get_branch_or_fail(coopname, braname);

  kuperiods_index periods(_marketplace, coopname.value);
  const kuperiod row = Marketplace::get_period_or_fail(periods, braname, period);

  const auto due = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SECURE_DUE, username);
  eosio::check(due.available >= amount,
               std::string{"MARKETPLACE_DUE_EXCEEDS: К списанию заявлено больше, чем лежит на кошельке обеспечительной части: заявлено "} +
                 amount.to_string() + ", доступно " + due.available.to_string());

  const uint128_t H = HUNDR_PERCENTS;
  const auto part = [&](uint64_t rate) -> int64_t {
    return static_cast<int64_t>(static_cast<uint128_t>(base.amount) * rate / H);
  };
  int64_t to_branch = part(row.rate_branch);
  int64_t to_funds = part(row.rate_funds);
  int64_t to_initiator = part(row.rate_initiator);
  int64_t to_return = amount.amount - to_branch - to_funds - to_initiator;

  if (to_return < 0) {
    // Ставка заказа была ниже ставки прогона: уменьшаем части по порядку —
    // возврат, инициатору, фонды, участку, пока сумма не сойдётся с amount.
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

  const int64_t charged = to_branch + to_funds + to_initiator;
  if (charged > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::CHARGE_DUE,
                   processes::marketplace::SUPPLY,
                   eosio::asset(charged, _root_govern_symbol), username, order_hash,
                   Marketplace::Memo::get_charge_period_memo());
  }
  if (to_branch > 0) {
    Branch::accrue(_marketplace, coopname, braname,
                   eosio::asset(to_branch, _root_govern_symbol),
                   processes::marketplace::SUPPLY, order_hash,
                   Marketplace::Memo::get_charge_due_distribute_memo());
  }
  if (to_funds > 0) {
    Fund::accrue(_marketplace, coopname,
                 eosio::asset(to_funds, _root_govern_symbol),
                 processes::marketplace::SUPPLY, order_hash,
                 Marketplace::Memo::get_charge_period_funds_memo());
  }
  if (to_initiator > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::INITIATOR_SHARE,
                   processes::marketplace::SUPPLY,
                   eosio::asset(to_initiator, _root_govern_symbol), row.initiator, order_hash,
                   Marketplace::Memo::get_charge_period_initiator_memo());
  }
  if (to_return > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::RETURN_DUE,
                   processes::marketplace::SUPPLY,
                   eosio::asset(to_return, _root_govern_symbol), username, order_hash,
                   Marketplace::Memo::get_charge_period_return_memo());
  }
}
