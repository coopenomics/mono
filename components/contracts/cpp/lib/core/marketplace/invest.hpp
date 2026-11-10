#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

/**
 * Инвестиционный этап кооперативного участка Стола заказов — общий слой
 * (задача 99D-27). Расчёт возврата паевых взносов инициаторам (CRPS) и проверки,
 * которыми пользуются действия контракта marketplace и выход пайщика
 * (registrator). Таблицы — lib/domain/table_marketplace_invest.hpp.
 *
 * Модель расчёта. Единицы инициатора `units = used_money + property` —
 * использованный паевой взнос: имущество с момента приёма, деньги по мере оплаты
 * расходов из пула. Экономия участка, направленная инициаторам, увеличивает
 * счётчик участка `acc` на `сумма × SCALE / base`; каждый инициатор получает
 * `units × Δacc / SCALE` — пропорционально использованному. Инициатора
 * фиксируют (`checkpoint`) перед любым изменением его единиц: накопленное
 * переносится в `returned_fixed`, отметка `acc_join` догоняет счётчик.
 * Прогон не перебирает инициаторов; перебор идёт только по тем, чей возврат
 * завершился в этом списании (индекс `bydone`), и по тем, чьи деньги
 * расходуются (индекс `byunused`).
 */
namespace MarketInvest {

inline eosio::asset zero_asset() { return eosio::asset(0, _root_govern_symbol); }

inline uint128_t mul(int64_t units, uint64_t acc) {
  return static_cast<uint128_t>(units) * static_cast<uint128_t>(acc);
}

/// Возмещено инициатору при текущем счётчике участка, единицы актива.
inline int64_t returned_of(const mkt_investor& i, uint64_t acc) {
  const int64_t u = i.units();
  if (i.status != Status::ACTIVE || u <= 0) return i.returned_fixed;
  return i.returned_fixed + static_cast<int64_t>(mul(u, acc - i.acc_join) / SCALE);
}

/// Счётчик участка, при котором использованное инициатора вернётся целиком.
inline uint64_t done_threshold(const mkt_investor& i) {
  const int64_t u = i.units();
  if (u <= 0) return OUT_OF_RANGE;
  const int64_t remaining = u - i.returned_fixed;
  if (remaining <= 0) return i.acc_join;
  const uint128_t num = static_cast<uint128_t>(remaining) * SCALE;
  const uint128_t step = (num + static_cast<uint128_t>(u) - 1) / static_cast<uint128_t>(u);
  return i.acc_join + static_cast<uint64_t>(step);
}

/// Сдвинуть денежную часть базы возврата участка. Строка прежней сборки поля
/// не несёт — считается с нуля; отрицательной база не бывает.
inline void shift_base_money(mkt_invbranch& b, int64_t delta) {
  const int64_t v = b.base_money_or_zero() + delta;
  b.base_money = v > 0 ? v : 0;
}

/// Вывести инициатора из базы участка, зафиксировав накопленное.
inline void leave_base(mkt_invbranch& b, mkt_investor& i) {
  const int64_t u = i.units();
  if (i.status == Status::ACTIVE && u > 0) {
    // В s_fixed лежит прежний returned_fixed; приращение от acc_join до acc
    // сидит в (acc × base − s_join) и вычитается вместе с base и s_join.
    b.s_fixed -= i.returned_fixed;
    b.base -= u;
    shift_base_money(b, -i.used_money.amount);
    b.s_join -= mul(u, i.acc_join);
    i.returned_fixed = returned_of(i, b.acc);
  }
  i.acc_join = b.acc;
}

/// Ввести инициатора в базу участка с текущей отметкой счётчика.
inline void enter_base(mkt_invbranch& b, mkt_investor& i) {
  i.acc_join = b.acc;
  const int64_t u = i.units();
  if (i.status == Status::ACTIVE && u > 0) {
    b.base += u;
    shift_base_money(b, i.used_money.amount);
    b.s_join += mul(u, b.acc);
    b.s_fixed += i.returned_fixed;
  }
  i.acc_done = done_threshold(i);
}

/// Непогашенный остаток использованного по участку (O(1), с округлением вниз
/// по каждому инициатору не больше единицы актива на инициатора).
inline int64_t outstanding(const mkt_invbranch& b) {
  if (b.base <= 0) return 0;
  const uint128_t accrued = mul(b.base, b.acc) - b.s_join;
  const int64_t left = b.base - b.s_fixed - static_cast<int64_t>(accrued / SCALE);
  return left > 0 ? left : 0;
}

/// Принять сумму возмещения в счётчик участка.
inline void accept_repay(mkt_invbranch& b, int64_t amount) {
  b.acc += static_cast<uint64_t>(static_cast<uint128_t>(amount) * SCALE /
                                 static_cast<uint128_t>(b.base));
}

/// Сумма возмещения, разделённая на долю денег и долю имущества.
struct RepayParts {
  int64_t money = 0;     ///< гасит 26 (Дт 86 / Кт 26)
  int64_t property = 0;  ///< без проводки: имущество на 10
  int64_t total() const { return money + property; }
};

/// Доля денег в сумме — пропорционально денежной части в единицах. Имущество
/// получает остаток округления: так 26 никогда не гасится сверх расходов.
inline RepayParts split_repay(int64_t amount, int64_t money_units, int64_t units) {
  RepayParts p;
  if (amount <= 0 || units <= 0) {
    p.property = amount > 0 ? amount : 0;
    return p;
  }
  const int64_t m = money_units > units ? units : (money_units > 0 ? money_units : 0);
  p.money = static_cast<int64_t>(static_cast<uint128_t>(amount) * static_cast<uint128_t>(m) /
                                 static_cast<uint128_t>(units));
  p.property = amount - p.money;
  return p;
}

/// Завершить возврат инициатора: вывести из базы, вернуть переплату — по
/// долям денег и имущества его единиц. Неиспользованные деньги остаются в
/// средствах участка (`unused_total`) и в очереди расхода, пока инициатор не
/// забрал их заявлением: часть из них может быть выделена под расход или
/// помощь, которые ещё не оплачены, и оплата обязана найти эти деньги.
inline RepayParts complete(mkt_invbranch& b, mkt_investor& i) {
  leave_base(b, i);
  const int64_t u = i.units();
  int64_t excess = i.returned_fixed - u;
  if (excess < 0) excess = 0;
  i.returned_fixed -= excess;
  i.status = Status::DONE;
  i.acc_done = OUT_OF_RANGE;
  return split_repay(excess, i.used_money.amount, u);
}

/// Сколько инициатор вправе транслировать в главный паевой сейчас:
/// возмещённое минус транслированное и, когда возмещение завершено или участку больше
/// нечего возмещать, неиспользованные деньги.
struct Claimable {
  int64_t returned = 0;  ///< из возмещённого
  int64_t unused = 0;    ///< из неиспользованных денег
  int64_t total() const { return returned + unused; }
};

inline Claimable claimable_of(const mkt_invbranch& b, const mkt_investor& i) {
  Claimable c;
  int64_t r = returned_of(i, b.acc);
  if (r > i.units()) r = i.units();
  c.returned = r - i.claimed.amount;
  if (c.returned < 0) c.returned = 0;
  const bool release_unused = i.status == Status::DONE || b.base <= 0;
  if (release_unused && i.unused() > 0) {
    c.unused = i.unused();
    // Деньги, выделенные в пул и ещё не израсходованные, держат неиспользованное
    // у любого инициатора — и у завершившего возврат.
    const int64_t free = b.unused_total.amount - b.reserved.amount;
    if (c.unused > free) c.unused = free > 0 ? free : 0;
  }
  return c;
}

/// Строка участка; без неё паевых взносов в участке нет.
inline std::optional<mkt_invbranch> get_branch(eosio::name coopname, eosio::name braname) {
  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto it = branches.find(braname.value);
  if (it == branches.end()) return std::nullopt;
  return *it;
}

/// Свободные средства инициаторов участка: неиспользованное минус уже
/// выделенное под расходы. По нему участок выбирает источник расхода и
/// материальной помощи, когда своих средств не хватает (задача 99D-28).
inline eosio::asset free_of(eosio::name coopname, eosio::name braname) {
  const auto b = get_branch(coopname, braname);
  if (!b.has_value()) return zero_asset();
  const eosio::asset free = b->unused_total - b->reserved;
  return free.amount > 0 ? free : zero_asset();
}

/// Выделить средства инициаторов под расход или помощь участка (marketplace::fundipool).
inline void fund_pool(eosio::name actor, eosio::name coopname, eosio::name braname,
                      eosio::asset amount, const checksum256& hash) {
  eosio::action(eosio::permission_level{actor, "active"_n}, _marketplace, "fundipool"_n,
                std::make_tuple(coopname, braname, amount, hash)).send();
}

/// Вернуть невыделенный остаток в средства инициаторов (marketplace::unfundipool).
inline void unfund_pool(eosio::name actor, eosio::name coopname, eosio::name braname,
                        eosio::asset amount, const checksum256& hash) {
  eosio::action(eosio::permission_level{actor, "active"_n}, _marketplace, "unfundipool"_n,
                std::make_tuple(coopname, braname, amount, hash)).send();
}

/// Расход из средств инициаторов оплачен — в базу возврата (marketplace::spentipool).
inline void spent_pool(eosio::name actor, eosio::name coopname, eosio::name braname,
                       eosio::asset amount, const checksum256& hash) {
  eosio::action(eosio::permission_level{actor, "active"_n}, _marketplace, "spentipool"_n,
                std::make_tuple(coopname, braname, amount, hash)).send();
}

/// Пайщик — оператор участка: председатель или доверенное лицо. В MVP вносить
/// средства в участок могут только операторы (решение владельца 07.11.2026);
/// правило держит одна функция, чтобы открыть внесение любому пайщику.
inline bool is_operator(eosio::name coopname, eosio::name braname, eosio::name username) {
  const auto branch = get_branch_or_fail(coopname, braname);
  return branch.trustee == username || branch.is_account_in_trusted(username);
}

/// Договор участия в хозяйственной деятельности подписан.
inline bool has_agreement(eosio::name coopname, eosio::name username) {
  mkt_invagreements_index agreements(_marketplace, coopname.value);
  return agreements.find(username.value) != agreements.end();
}

/// Есть ли у пайщика строки инициатора: выходу нужно вычесть его из базы.
inline bool has_investments(eosio::name coopname, eosio::name username) {
  mkt_investors_index investors(_marketplace, coopname.value);
  auto by_user = investors.get_index<"byuser"_n>();
  return by_user.find(username.value) != by_user.end();
}

/// Выход инициатора не должен оставить без покрытия деньги, уже выделенные
/// под расход участка: пока такой расход не закрыт, выход ждёт.
inline void check_member_can_exit(eosio::name coopname, eosio::name username) {
  mkt_investors_index investors(_marketplace, coopname.value);
  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto by_user = investors.get_index<"byuser"_n>();
  for (auto it = by_user.lower_bound(username.value);
       it != by_user.end() && it->username == username; ++it) {
    if (it->unused() <= 0) continue;
    auto bit = branches.find(it->braname.value);
    if (bit == branches.end()) continue;
    eosio::check(bit->unused_total.amount - it->unused() >= bit->reserved.amount,
                 "MARKETPLACE_INVEST_EXIT_RESERVED: Выход из кооператива невозможен: средства инициатора выделены под расход участка — дождитесь его закрытия");
  }
}

} // namespace MarketInvest

namespace Marketplace {

/// Записать паевой взнос инициатора в участок: деньги становятся подушкой пула,
/// имущество сразу входит в базу возврата. Строки участка и инициатора
/// заводятся первым паевым взносом; инициатор с завершённым возвратом снова
/// становится активным.
inline void add_investment(eosio::name coopname, eosio::name braname, eosio::name username,
                           eosio::asset money, eosio::asset property) {
  using namespace MarketInvest;
  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto bit = branches.find(braname.value);
  if (bit == branches.end()) {
    bit = branches.emplace(RamPayer::of(branches, coopname), [&](auto& b) {
      b.braname        = braname;
      b.money_total    = zero_asset();
      b.property_total = zero_asset();
      b.unused_total   = zero_asset();
      b.reserved       = zero_asset();
      b.spent_total    = zero_asset();
      b.repaid_total   = zero_asset();
      b.surplus_total  = zero_asset();
    });
  }
  mkt_invbranch b = *bit;

  mkt_investors_index investors(_marketplace, coopname.value);
  auto by_pair = investors.get_index<"bybruser"_n>();
  auto it = by_pair.find(combine_ids(braname.value, username.value));
  const bool fresh = it == by_pair.end();

  mkt_investor row;
  if (fresh) {
    row.id         = investors.available_primary_key();
    row.braname    = braname;
    row.username   = username;
    row.status     = Status::ACTIVE;
    row.money      = zero_asset();
    row.property   = zero_asset();
    row.used_money = zero_asset();
    row.claimed    = zero_asset();
    row.join_seq   = ++b.join_seq;
    row.joined_at  = eosio::time_point_sec(eosio::current_time_point());
  } else {
    row = *it;
    leave_base(b, row);
  }

  // До прибавки: у строки прежней сборки запасное значение — текущий остаток.
  row.money_in        = row.money_in_or_current() + money;
  row.money          += money;
  row.property       += property;
  b.money_total      += money;
  b.property_total   += property;
  b.unused_total     += money;
  // Завершивший возврат возвращается в базу, только когда у него появилось
  // невозмещённое — новое имущество. Новые деньги до расхода в базу не входят:
  // он остаётся завершившим и может забрать их заявлением. Иначе он стоял бы в
  // базе с нулевым остатком к возмещению, завершить возврат было бы нечем, и
  // его неиспользованные деньги остались бы закрыты.
  if (row.status == Status::DONE && row.units() > row.returned_fixed) row.status = Status::ACTIVE;
  enter_base(b, row);

  branches.modify(bit, RamPayer::of(branches, coopname), [&](auto& x) { x = b; });
  if (fresh) {
    investors.emplace(RamPayer::of(investors, coopname), [&](auto& x) { x = row; });
  } else {
    by_pair.modify(it, RamPayer::of(investors, coopname), [&](auto& x) { x = row; });
  }
}

/// Доля инициаторов из экономии участка в списании заказа (chargeperiod).
/// Пока паевые взносы участка не возмещены, она возмещает их: перевод на кошелёк
/// возмещения участка и рост счётчика возврата. Сверх непогашенного и когда
/// возмещать нечего — на общий кошелёк участка (o.brn.common). Инициаторы,
/// чей возврат завершился в этом списании, выбывают из базы; их переплата
/// переводится участку. Решение владельца 07.11.2026, задача 99D-27.
///
/// Возмещение (o.mkt.repay, Дт 80 / Кт 86) делает долю инициаторов членским
/// взносом. Её доля денег в базе возврата гасит расходы и помощь, оплаченные
/// деньгами инициаторов: o.mkt.icover, Дт 86 / Кт 26, только проводка. Доля
/// имущества 26 не гасит — имущество остаётся на 10. Денежная доля переплаты,
/// переведённой участку, — сторно o.mkt.iuncov, Дт 26 / Кт 86. Решение
/// владельца 09.11.2026, бухгалтер подтвердила 10.11.2026.
inline void route_initiator_share(eosio::name actor, eosio::name coopname, eosio::name braname,
                                  eosio::asset amount, const checksum256& order_hash) {
  using namespace MarketInvest;
  int64_t to_repay = 0;
  int64_t left = 0;

  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto bit = branches.find(braname.value);
  if (bit != branches.end() && bit->base > 0) {
    left = outstanding(*bit);
    to_repay = amount.amount < left ? amount.amount : left;
  }

  if (to_repay > 0) {
    Ledger2::apply(actor, coopname, operations::marketplace::INVEST_REPAY,
                   processes::marketplace::SUPPLY, eosio::asset(to_repay, _root_govern_symbol),
                   braname, order_hash, Memo::get_invest_repay_memo());

    mkt_invbranch b = *bit;
    // Каждому инициатору возмещается пропорционально его единицам, поэтому
    // доля денег во всём возмещении — денежная часть базы к базе.
    const RepayParts repay = split_repay(to_repay, b.base_money_or_zero(), b.base);
    if (repay.money > 0)
      Ledger2::apply(actor, coopname, operations::marketplace::INVEST_COST_COVER,
                     processes::marketplace::SUPPLY, eosio::asset(repay.money, _root_govern_symbol),
                     braname, order_hash, Memo::get_invest_cost_cover_memo());

    accept_repay(b, to_repay);
    b.repaid_total.amount += to_repay;

    // Завершившие возврат — по индексу от наименьшего порога; каждый шаг
    // меняет ключ строки на «вне базы», поэтому выборка начинается заново.
    mkt_investors_index investors(_marketplace, coopname.value);
    auto by_done = investors.get_index<"bydone"_n>();
    const uint128_t from = combine_ids(braname.value, 0);
    const uint128_t upto = combine_ids(braname.value, b.acc);
    RepayParts excess;
    for (auto it = by_done.lower_bound(from); it != by_done.end() && it->by_done() <= upto;
         it = by_done.lower_bound(from)) {
      mkt_investor row = *it;
      const RepayParts e = complete(b, row);
      excess.money += e.money;
      excess.property += e.property;
      by_done.modify(it, RamPayer::of(investors, coopname), [&](auto& x) { x = row; });
    }

    // Списание возместило весь непогашенный остаток участка: в базе не
    // остаётся никого. Счётчик растёт с округлением вниз, поэтому инициатору
    // могла остаться единица актива до порога завершения, и возврат завершался
    // только следующим списанием. Возвращённое таких инициаторов фиксируется
    // ровно в использованное — переведённая на кошелёк возмещения сумма это
    // покрывает.
    if (to_repay == left) {
      const uint128_t all = combine_ids(braname.value, OUT_OF_RANGE);
      for (auto it = by_done.lower_bound(from); it != by_done.end() && it->by_done() < all;
           it = by_done.lower_bound(from)) {
        mkt_investor row = *it;
        const RepayParts e = complete(b, row);
        row.returned_fixed = row.units();
        excess.money += e.money;
        excess.property += e.property;
        by_done.modify(it, RamPayer::of(investors, coopname), [&](auto& x) { x = row; });
      }
    }

    // Денежная доля переплаты не может превысить погашенное этим списанием —
    // остальное считается долей имущества: кредитового сальдо по 26 не бывает.
    if (excess.money > repay.money) {
      excess.property += excess.money - repay.money;
      excess.money = repay.money;
    }
    if (excess.total() > 0) {
      b.surplus_total.amount += excess.total();
      Ledger2::apply(actor, coopname, operations::marketplace::INVEST_REPAY_SURPLUS,
                     processes::marketplace::SUPPLY, eosio::asset(excess.total(), _root_govern_symbol),
                     braname, order_hash, Memo::get_invest_surplus_memo());
      if (excess.money > 0)
        Ledger2::apply(actor, coopname, operations::marketplace::INVEST_COST_UNCOVER,
                       processes::marketplace::SUPPLY, eosio::asset(excess.money, _root_govern_symbol),
                       braname, order_hash, Memo::get_invest_cost_uncover_memo());
    }
    branches.modify(bit, RamPayer::of(branches, coopname), [&](auto& x) { x = b; });
  }

  const int64_t rest = amount.amount - to_repay;
  if (rest > 0) {
    Branch::accrue(actor, coopname, braname, eosio::asset(rest, _root_govern_symbol),
                   processes::marketplace::SUPPLY, order_hash,
                   Memo::get_charge_due_distribute_memo());
  }
}

/// Выход пайщика одобрен: паевой взнос по договору участия переносится на главный
/// паевой политикой выхода (o.mkt.iexit), а marketplace той же транзакцией
/// вычитает пайщика из базы возврата участков (решение владельца 07.11.2026).
inline void release_investments_on_exit(eosio::name actor, eosio::name coopname,
                                        eosio::name username) {
  if (!MarketInvest::has_investments(coopname, username)) return;
  eosio::action(eosio::permission_level{actor, "active"_n}, _marketplace, "exitinv"_n,
                std::make_tuple(coopname, username)).send();
}

} // namespace Marketplace
