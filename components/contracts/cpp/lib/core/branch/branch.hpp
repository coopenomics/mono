#pragma once

#include <string>
#include <tuple>

#include <eosio/action.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"

/**
 * Чтение таблиц branch / branchstat (domain/index.hpp — раньше).
 */
namespace Branch {

uint64_t get_branch_count(eosio::name coopname) {
  branchstat_index stat(_branch, _branch.value);
  auto st = stat.find(coopname.value);

  if (st == stat.end()) {
    return 0;
  }

  return st->count;
}

bool is_trustee(eosio::name coopname, eosio::name username) {
  branch_index branches(_branch, coopname.value);

  auto by_trustee_index = branches.get_index<"bytrustee"_n>();
  auto trustee_itr = by_trustee_index.find(username.value);

  return trustee_itr != by_trustee_index.end();
}

bool is_trusted(eosio::name coopname, eosio::name braname, eosio::name username) {
  branch_index branches(_branch, coopname.value);
  auto branch_itr = branches.find(braname.value);

  if (branch_itr == branches.end()) {
    return false;
  }

  return branch_itr->is_account_in_trusted(username);
}

/// Кооперативный участок существует (не удалён).
inline bool exists(eosio::name coopname, eosio::name braname) {
  branch_index branches(_branch, coopname.value);
  return branches.find(braname.value) != branches.end();
}

/**
 * @brief Inline-вызов branch::accrue от контракта-источника членских
 * взносов (requirement b6 «Экономика КУ», раунд 5: приоритет общего
 * кошелька): зачисление 100% взноса в общий кошелёк КУ (o.brn.common).
 * Дальнейшее использование — отдельные команды председателя
 * (distribute / createexp) после контроля планового резерва бэкендом.
 */
inline void accrue(eosio::name actor, eosio::name coopname, eosio::name braname,
                   eosio::asset amount, eosio::name process_type,
                   eosio::checksum256 process_hash, std::string memo) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _branch,
    "accrue"_n,
    std::make_tuple(coopname, braname, actor, amount, process_type, process_hash, memo)
  ).send();
}

/**
 * @brief Inline-вызов branch::retfee от контракта-источника — точная
 * инверсия accrue: членский взнос возвращается из общего кошелька КУ в пул
 * взносов «Стола заказов» (o.brn.retfee, username = braname).
 *
 * Нужен при гарантийном возврате имущества: пайщику возвращается полная
 * уплаченная сумма, включая членский взнос, а не только стоимость имущества.
 * Вторую ногу (пул → членский кошелёк заказчика) делает контракт-источник
 * своей операцией возврата взноса — прямой перевод между кошельком КУ и
 * кошельком пайщика невозможен (walletop держит один username на обе стороны).
 *
 * Средства должны физически быть в общем кошельке КУ: если участок уже
 * распределил или потратил их, вызов падает с человекочитаемым текстом —
 * председатель сначала пополняет общий кошелёк.
 */
inline void retfee(eosio::name actor, eosio::name coopname, eosio::name braname,
                   eosio::asset amount, eosio::name process_type,
                   eosio::checksum256 process_hash, std::string memo) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _branch,
    "retfee"_n,
    std::make_tuple(coopname, braname, actor, amount, process_type, process_hash, memo)
  ).send();
}

// ── Резерв социально-экономического обеспечения пайщиков (задача 99D-20, КЭУ-2) ──

/**
 * @brief Номер календарного месяца по UTC для времени блока: год × 12 + месяц.
 *
 * Считается из числа дней от эпохи по гражданскому календарю (алгоритм
 * Хиннанта), без таблиц и без часового пояса: контракт не знает пояс
 * кооператива, предел материальной помощи ведётся по UTC. Номер сравним с
 * `monthKey` ИСТОКА только по смыслу, не по значению.
 */
inline uint32_t utc_month_period(eosio::time_point_sec at) {
  const int64_t days = static_cast<int64_t>(at.sec_since_epoch()) / 86400;
  const int64_t z = days + 719468;
  const int64_t era = (z >= 0 ? z : z - 146096) / 146097;
  const int64_t doe = z - era * 146097;
  const int64_t yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  const int64_t y = yoe + era * 400;
  const int64_t doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const int64_t mp = (5 * doy + 2) / 153;
  const int64_t m = mp < 10 ? mp + 3 : mp - 9;
  const int64_t year = m <= 2 ? y + 1 : y;
  return static_cast<uint32_t>(year * 12 + m);
}

/// Длина периода предела материальной помощи, секунд; ноль — календарный месяц UTC.
inline uint32_t aid_period_seconds(eosio::name coopname) {
  brnconfig_singleton cfg(_branch, coopname.value);
  if (!cfg.exists()) return 0;
  const auto state = cfg.get();
  return state.aid_period_seconds.has_value() ? state.aid_period_seconds.value() : 0;
}

/**
 * @brief Номер периода, за который считается предел материальной помощи.
 *
 * В рабочем режиме — календарный месяц UTC (`utc_month_period`). Если в
 * настройках участков задана длина периода (стенд со сжатым временем) — номер
 * отрезка этой длины от эпохи, как у итогов месяцев на стенде. Номера двух
 * режимов не пересекаются по величине, смена режима начинает период заново.
 */
inline uint32_t aid_period(eosio::name coopname, eosio::time_point_sec at) {
  const uint32_t seconds = aid_period_seconds(coopname);
  return seconds > 0 ? at.sec_since_epoch() / seconds : utc_month_period(at);
}

/// Потолок резерва на получателя в месяц; ноль — резерв выключен.
inline eosio::asset aid_month_limit(eosio::name coopname) {
  brnconfig_singleton cfg(_branch, coopname.value);
  return cfg.exists() ? cfg.get().aid_month_limit : eosio::asset(0, _root_govern_symbol);
}

/// Строка резерва получателя на участке; `found` — есть ли она.
inline eosio::asset reserve_of(eosio::name coopname, eosio::name braname,
                               eosio::name username, bool &found) {
  branch_reserves_index reserves(_branch, coopname.value);
  auto idx = reserves.get_index<"bybruser"_n>();
  auto it = idx.find(combine_ids(braname.value, username.value));
  found = it != idx.end();
  return found ? it->amount : eosio::asset(0, _root_govern_symbol);
}

/// Наибольший разрыв периодов, за который доначисляется право получателя помощи.
constexpr uint32_t MAX_ACCRUAL_GAP = 1200;

/**
 * @brief Накопленное право получателя на материальную помощь на период `now`
 * (задача 99D-34): остаток на период начисления плюс сумма строки за каждый
 * прошедший период. Строка до 99D-34 — право текущего периода: сумма строки
 * минус поданное за период по накопителю `aidmonths`.
 */
inline eosio::asset outstanding_of(eosio::name coopname, const branch_reserve &r, uint32_t now) {
  if (!r.accrued_period.has_value() || !r.outstanding.has_value()) {
    branch_aidmonths_index months(_branch, coopname.value);
    auto month = months.find(r.username.value);
    const int64_t used = (month != months.end() && month->period == now) ? month->total.amount : 0;
    return eosio::asset(r.amount.amount > used ? r.amount.amount - used : 0, r.amount.symbol);
  }
  eosio::asset total = r.outstanding.value();
  const uint32_t last = r.accrued_period.value();
  // Разрыв больше MAX_ACCRUAL_GAP периодов или номер меньше прежнего — смена
  // режима нумерации (длина периода стенда `setaidperiod`, календарный месяц ↔
  // отрезок секунд), а не прошедшее время: право не доначисляется, отсчёт
  // начнётся заново при следующей записи строки. В рабочем режиме 1200
  // периодов — сто лет.
  if (now > last && now - last <= MAX_ACCRUAL_GAP) total.amount += r.amount.amount * static_cast<int64_t>(now - last);
  return total;
}

/**
 * @brief Сумма строк резерва участка за один месяц — прежняя формула итога
 * месяца (до 99D-34), ею считает старый узел, пока не выложен новый.
 */
inline eosio::asset sum_reserves(eosio::name coopname, eosio::name braname) {
  branch_reserves_index reserves(_branch, coopname.value);
  auto idx = reserves.get_index<"bybranch"_n>();
  eosio::asset total(0, _root_govern_symbol);
  for (auto it = idx.lower_bound(braname.value);
       it != idx.end() && it->braname == braname; ++it) {
    total += it->amount;
  }
  return total;
}

/**
 * @brief Сумма накопленного права получателей участка на период `now` —
 * слагаемое цели резерва участка в итоге месяца Стола заказов. Строк у
 * участка единицы (председатель и доверенные), перебор по индексу участка.
 */
inline eosio::asset sum_outstanding(eosio::name coopname, eosio::name braname, uint32_t now) {
  branch_reserves_index reserves(_branch, coopname.value);
  auto idx = reserves.get_index<"bybranch"_n>();
  eosio::asset total(0, _root_govern_symbol);
  for (auto it = idx.lower_bound(braname.value);
       it != idx.end() && it->braname == braname; ++it) {
    total += outstanding_of(coopname, *it, now);
  }
  return total;
}

/**
 * @brief Стереть строки резерва участка: одного получателя либо все
 * (`username` пустой). Зовётся при снятии доверенного лица, удалении участка
 * и действием `delreserve`.
 */
inline void erase_reserves(eosio::name coopname, eosio::name braname, eosio::name username) {
  branch_reserves_index reserves(_branch, coopname.value);
  auto idx = reserves.get_index<"bybranch"_n>();
  auto it = idx.lower_bound(braname.value);
  while (it != idx.end() && it->braname == braname) {
    if (username.value != 0 && it->username != username) { ++it; continue; }
    it = idx.erase(it);
  }
}

} // namespace Branch
