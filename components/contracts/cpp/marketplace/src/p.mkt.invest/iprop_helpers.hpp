#pragma once

/**
 * Помощники пути имущества инициатора (задача 99D-27): поиск заявления по
 * хэшу и проверка подписи председателя участка.
 */
namespace MarketInvestProperty {

inline mkt_invprop get_or_fail(eosio::name coopname, const checksum256& hash) {
  mkt_invprops_index props(_marketplace, coopname.value);
  auto by_hash = props.get_index<"byhash"_n>();
  auto it = by_hash.find(hash);
  eosio::check(it != by_hash.end(),
               "MARKETPLACE_IPROP_NOT_FOUND: Заявление о паевом взносе имуществом в участок не найдено");
  return *it;
}

template <typename F>
inline void update(eosio::name coopname, uint64_t id, F&& fn) {
  mkt_invprops_index props(_marketplace, coopname.value);
  auto it = props.find(id);
  props.modify(it, RamPayer::of(props, coopname), std::forward<F>(fn));
}

inline void erase(eosio::name coopname, uint64_t id) {
  mkt_invprops_index props(_marketplace, coopname.value);
  auto it = props.find(id);
  if (it != props.end()) props.erase(it);
}

/// Председатель участка — тот, кто подписывает за участок.
inline eosio::name trustee_of(eosio::name coopname, eosio::name braname) {
  return get_branch_or_fail(coopname, braname).trustee;
}

} // namespace MarketInvestProperty
