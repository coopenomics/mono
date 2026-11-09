#pragma once

#include <optional>
#include <string>

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../../consts.hpp"
#include "../../domain/table_marketplace_dues.hpp"
#include "../../domain/table_marketplace_orders.hpp"
#include "../branch/branch.hpp"

/**
 * @brief Счётчики обеспечительной части к списанию (задача 99D-33).
 *
 * Единственное место, где пишутся таблицы `kudues` и `kucounters`. Правило:
 * каждое движение по кошельку пайщика к списанию `w.mkt.due` отражается в
 * счётчиках той же транзакцией — пополнение при выдаче и удержании при отказе,
 * уменьшение при гарантийном возврате, стирание при выходе пайщика и при
 * списании. Так сумма строк пайщика всегда равна остатку его кошелька, а
 * списанию первого числа не нужны данные узла.
 */
namespace Marketplace::Dues {

using namespace eosio;

/// Период списания для момента: тот же период, что у предела материальной
/// помощи участков (`Branch::aid_period`) — календарный месяц UTC либо отрезок
/// длины `brnconfig.aid_period_seconds` на стенде со сжатым временем.
inline uint32_t period_of(eosio::name coopname, eosio::time_point_sec at) {
  return Branch::aid_period(coopname, at);
}

/// Период списания, идущий сейчас: его строки ещё копятся и не списываются.
inline uint32_t current_period(eosio::name coopname) {
  return period_of(coopname, eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()));
}

/// Период созревания заказа: по концу гарантийного срока; без гарантии — момент выдачи.
inline uint32_t maturity_period(eosio::name coopname, eosio::time_point_sec warranty_until) {
  if (warranty_until.sec_since_epoch() > 0) return period_of(coopname, warranty_until);
  return current_period(coopname);
}

/**
 * @brief Хэш процесса списания строки счётчика — нитка `p.mkt.due`.
 *
 * Строка объединяет заказы пайщика на участке за период, поэтому хэша заказа у
 * списания нет. Хэш детерминирован: sha256 строки
 * `p.mkt.due:<coopname>:<username>:<braname>:<period>`; узел считает его так же,
 * чтобы показать пайщику движения списания.
 */
inline checksum256 charge_hash(eosio::name coopname, eosio::name username,
                               eosio::name braname, uint32_t period) {
  const std::string seed = "p.mkt.due:" + coopname.to_string() + ":" + username.to_string() + ":" +
                           braname.to_string() + ":" + std::to_string(period);
  return eosio::sha256(seed.data(), seed.size());
}

/// Итератор строки пайщика по ключу (пайщик, участок, период): у пайщика
/// строк столько, сколько открытых периодов на участках, где он получал
/// имущество, — единицы, перебор по его индексу ограничен ими.
inline std::optional<uint64_t> find_member_id(eosio::name coopname, eosio::name username,
                                              eosio::name braname, uint32_t period) {
  kudues_index dues(_marketplace, coopname.value);
  auto by_user = dues.get_index<"byuser"_n>();
  for (auto it = by_user.lower_bound(username.value);
       it != by_user.end() && it->username == username; ++it) {
    if (it->braname == braname && it->period == period) return it->id;
  }
  return std::nullopt;
}

inline std::optional<kudue> find_member(eosio::name coopname, eosio::name username,
                                        eosio::name braname, uint32_t period) {
  const auto id = find_member_id(coopname, username, braname, period);
  if (!id.has_value()) return std::nullopt;
  kudues_index dues(_marketplace, coopname.value);
  return dues.get(*id);
}

/// Есть ли у пайщика хоть одна строка счётчика (выход пайщика).
inline bool has_member_rows(eosio::name coopname, eosio::name username) {
  kudues_index dues(_marketplace, coopname.value);
  auto by_user = dues.get_index<"byuser"_n>();
  return by_user.find(username.value) != by_user.end();
}

inline std::optional<uint64_t> find_counter_id(eosio::name coopname, eosio::name braname, uint32_t period) {
  kucounters_index counters(_marketplace, coopname.value);
  auto idx = counters.get_index<"bybrperiod"_n>();
  auto it = idx.find(combine_ids(braname.value, period));
  if (it == idx.end()) return std::nullopt;
  return it->id;
}

inline std::optional<kucounter> find_counter(eosio::name coopname, eosio::name braname, uint32_t period) {
  const auto id = find_counter_id(coopname, braname, period);
  if (!id.has_value()) return std::nullopt;
  kucounters_index counters(_marketplace, coopname.value);
  return counters.get(*id);
}

/// Строка счётчика участка: найти либо завести пустую.
inline uint64_t ensure_counter(eosio::name coopname, eosio::name braname, uint32_t period) {
  const auto found = find_counter_id(coopname, braname, period);
  if (found.has_value()) return *found;
  kucounters_index counters(_marketplace, coopname.value);
  const uint64_t id = counters.available_primary_key();
  counters.emplace(RamPayer::of(counters), [&](auto& c) {
    c.id       = id;
    c.braname  = braname;
    c.period   = period;
    c.turnover = eosio::asset(0, _root_govern_symbol);
    c.secured  = eosio::asset(0, _root_govern_symbol);
    c.retained = eosio::asset(0, _root_govern_symbol);
    c.orders   = 0;
    c.members  = 0;
  });
  return id;
}

/// Вычитание не ниже нуля: возврат после округлений не делает счётчик отрицательным.
inline void take(eosio::asset& from, const eosio::asset& amount) {
  from.amount = from.amount > amount.amount ? from.amount - amount.amount : 0;
}

/// Счётчик участка открыт (итог ещё не рассчитан) — поправить его суммы.
template <typename Fn>
inline void modify_counter_if_open(eosio::name coopname, eosio::name braname, uint32_t period, Fn&& fn) {
  const auto id = find_counter_id(coopname, braname, period);
  if (!id.has_value()) return;
  kucounters_index counters(_marketplace, coopname.value);
  counters.modify(counters.get(*id), RamPayer::of(counters), std::forward<Fn>(fn));
}

/// Строка счётчика пайщика: найти либо завести пустую. Новая строка — ещё одно
/// предстоящее списание в открытом счётчике участка; счётчик участка заводит
/// вызывающий (`ensure_counter`) — у периода с рассчитанным итогом его нет.
inline uint64_t ensure_member(eosio::name coopname, eosio::name username, eosio::name braname, uint32_t period) {
  const auto found = find_member_id(coopname, username, braname, period);
  if (found.has_value()) return *found;
  kudues_index dues(_marketplace, coopname.value);
  const uint64_t id = dues.available_primary_key();
  dues.emplace(RamPayer::of(dues), [&](auto& d) {
    d.id       = id;
    d.username = username;
    d.braname  = braname;
    d.period   = period;
    d.turnover = eosio::asset(0, _root_govern_symbol);
    d.due      = eosio::asset(0, _root_govern_symbol);
    d.retained = eosio::asset(0, _root_govern_symbol);
    d.orders   = 0;
  });
  modify_counter_if_open(coopname, braname, period, [&](auto& c) { c.members += 1; });
  return id;
}

/**
 * @brief Выдача закрыта: стоимость выданного и обеспечительная часть по факту
 * встают в счётчики периода, в котором кончается гарантийный срок. Заказ без
 * обеспечительной части (нулевая ставка) списанию не подлежит и в итог месяца
 * не входит — иначе он занижал бы ставки другим.
 */
inline void note_issue(eosio::name coopname, const order& o, const eosio::asset& cost,
                       const eosio::asset& fee, eosio::time_point_sec warranty_until) {
  if (fee.amount <= 0) return;
  const uint32_t period = maturity_period(coopname, warranty_until);
  const uint64_t counter_id = ensure_counter(coopname, o.delivery_braname, period);
  kudues_index dues(_marketplace, coopname.value);
  dues.modify(dues.get(ensure_member(coopname, o.orderer, o.delivery_braname, period)), RamPayer::of(dues), [&](auto& d) {
    d.turnover += cost;
    d.due      += fee;
    d.orders   += 1;
  });
  kucounters_index counters(_marketplace, coopname.value);
  counters.modify(counters.get(counter_id), RamPayer::of(counters), [&](auto& c) {
    c.turnover += cost;
    c.secured  += fee;
    c.orders   += 1;
  });
}

/**
 * @brief Удержание при отказе от получения после акцепта: половина тела и
 * половина обеспечительной части. Гарантии нет — созревает в текущем периоде
 * и списывается участку целиком, в ставки итога не входит.
 */
inline void note_retained(eosio::name coopname, const order& o, const eosio::asset& amount) {
  if (amount.amount <= 0) return;
  const uint32_t period = current_period(coopname);
  const uint64_t counter_id = ensure_counter(coopname, o.delivery_braname, period);
  kudues_index dues(_marketplace, coopname.value);
  dues.modify(dues.get(ensure_member(coopname, o.orderer, o.delivery_braname, period)), RamPayer::of(dues),
              [&](auto& d) { d.retained += amount; });
  kucounters_index counters(_marketplace, coopname.value);
  counters.modify(counters.get(counter_id), RamPayer::of(counters), [&](auto& c) { c.retained += amount; });
}

/**
 * @brief Гарантийный возврат принят: стоимость возвращённого и его
 * обеспечительная часть снимаются со счётчиков периода заказа. Строки нет —
 * обеспечительная часть по заказу уже списана по итогу периода, и возврат с
 * кошелька к списанию невозможен: отказ с кодом, решение совета не исполняется.
 * Счётчик участка поправляется, пока итог периода не рассчитан; после расчёта
 * ставки зафиксированы, списание строки пайщика идёт по ним на уменьшенные суммы.
 */
inline void note_return(eosio::name coopname, const order& o, const eosio::asset& cost, const eosio::asset& fee) {
  if (fee.amount <= 0) return;
  const uint32_t period = maturity_period(coopname, o.warranty_until);
  const auto id = find_member_id(coopname, o.orderer, o.delivery_braname, period);
  eosio::check(id.has_value(),
               "MARKETPLACE_DUE_CHARGED: Обеспечительная часть по заказу уже списана по итогу периода — возврат с кошелька к списанию невозможен");
  kudues_index dues(_marketplace, coopname.value);
  const kudue row = dues.get(*id);
  eosio::check(row.due >= fee,
               std::string{"MARKETPLACE_DUE_EXCEEDS: К возврату заявлено больше, чем учтено к списанию: заявлено "} +
                 fee.to_string() + ", учтено " + row.due.to_string());
  dues.modify(dues.get(*id), RamPayer::of(dues), [&](auto& d) {
    take(d.turnover, cost);
    d.due -= fee;
  });
  modify_counter_if_open(coopname, o.delivery_braname, period, [&](auto& c) {
    take(c.turnover, cost);
    take(c.secured, fee);
  });
}

/**
 * @brief Выход пайщика состоялся: его строки счётчиков стираются — остаток
 * кошелька к списанию целиком списан в членский взнос. Открытые счётчики
 * участков уменьшаются на его суммы, чтобы итог периода считался по тем
 * заказам, которые ещё предстоит списать.
 */
inline void release_member(eosio::name coopname, eosio::name username) {
  kudues_index dues(_marketplace, coopname.value);
  auto by_user = dues.get_index<"byuser"_n>();
  for (auto it = by_user.lower_bound(username.value);
       it != by_user.end() && it->username == username;
       it = by_user.lower_bound(username.value)) {
    const kudue row = *it;
    modify_counter_if_open(coopname, row.braname, row.period, [&](auto& c) {
      take(c.turnover, row.turnover);
      take(c.secured, row.due);
      take(c.retained, row.retained);
      c.orders  = c.orders > row.orders ? c.orders - row.orders : 0;
      c.members = c.members > 0 ? c.members - 1 : 0;
    });
    by_user.erase(it);
  }
}

/// Сумма строк пайщика к списанию (ставки и удержания вместе) — должна быть
/// не выше остатка его кошелька `w.mkt.due`.
inline eosio::asset member_total(eosio::name coopname, eosio::name username) {
  eosio::asset total(0, _root_govern_symbol);
  kudues_index dues(_marketplace, coopname.value);
  auto by_user = dues.get_index<"byuser"_n>();
  for (auto it = by_user.lower_bound(username.value);
       it != by_user.end() && it->username == username; ++it) {
    total += it->due;
    total += it->retained;
  }
  return total;
}

} // namespace Marketplace::Dues
