#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"

/**
 * @brief Реестр распределения членских взносов кооперативного участка
 * (requirement b6 «Экономика КУ»).
 *
 * Универсальный механизм: условия распределения задаются per
 * (КУ, контракт-источник) — сегодня источник один («Стол заказов»,
 * marketplace), но той же методикой смогут управляться финансы КУ других
 * потребительских программ.
 *
 * Доли — через веса, не проценты: доля участника = вес / Σ весов по
 * (braname, contract). Добавление/удаление доверенного перебалансирует доли
 * автоматически на следующих начислениях — ничего не блокируется и не
 * переносится (решение владельца 2026-06-10).
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: weights
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_weight {
  uint64_t    id;        ///< суррогатный ключ (scope coopname)
  eosio::name braname;   ///< кооперативный участок
  eosio::name contract;  ///< контракт-источник распределения (например, marketplace)
  eosio::name username;  ///< председатель или доверенный КУ
  uint64_t    weight;    ///< вес; доля = weight / Σ weights(braname, contract)

  uint64_t  primary_key() const { return id; }
  uint128_t by_contract_branch() const { return combine_ids(contract.value, braname.value); }
  uint64_t  by_branch() const { return braname.value; }
};

typedef eosio::multi_index<
    "weights"_n, branch_weight,
    eosio::indexed_by<"bycontrbra"_n, eosio::const_mem_fun<branch_weight, uint128_t, &branch_weight::by_contract_branch>>,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<branch_weight, uint64_t, &branch_weight::by_branch>>>
    branch_weights_index;

/**
 * @brief Агрегат весов по (КУ, контракт-источник): сумма весов всех
 * участников распределения. Поддерживается автоматически действиями
 * setweight/delweight/deltrusted; используется при раскладке в distribute и
 * для чтения столом ПВЗ («сумма весов по конкретной ЦПП»).
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: weighttotals
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_weight_total {
  uint64_t    id;            ///< суррогатный ключ (scope coopname)
  eosio::name braname;       ///< кооперативный участок
  eosio::name contract;      ///< контракт-источник распределения
  uint64_t    total_weight;  ///< Σ весов участников

  uint64_t  primary_key() const { return id; }
  uint128_t by_contract_branch() const { return combine_ids(contract.value, braname.value); }
  uint64_t  by_branch() const { return braname.value; }
};

typedef eosio::multi_index<
    "weighttotals"_n, branch_weight_total,
    eosio::indexed_by<"bycontrbra"_n, eosio::const_mem_fun<branch_weight_total, uint128_t, &branch_weight_total::by_contract_branch>>,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<branch_weight_total, uint64_t, &branch_weight_total::by_branch>>>
    branch_weight_totals_index;

/**
 * @brief Применить дельту к агрегату весов (braname, contract). Создаёт
 * запись при первой положительной дельте, удаляет при обнулении.
 * Используется в setweight/delweight/deltrusted.
 */
void apply_weight_total_delta(eosio::name coopname, eosio::name braname,
                              eosio::name contract, int64_t delta) {
  if (delta == 0) return;

  branch_weight_totals_index totals(_branch, coopname.value);
  auto idx = totals.get_index<"bycontrbra"_n>();
  auto it  = idx.find(combine_ids(contract.value, braname.value));

  if (it == idx.end()) {
    eosio::check(delta > 0, "Системная ошибка: агрегат весов распределения отсутствует");
    totals.emplace(coopname, [&](auto& t) {
      t.id           = totals.available_primary_key();
      t.braname      = braname;
      t.contract     = contract;
      t.total_weight = static_cast<uint64_t>(delta);
    });
    return;
  }

  eosio::check(delta > 0 || it->total_weight >= static_cast<uint64_t>(-delta),
               "Системная ошибка: агрегат весов распределения ушёл бы в минус");
  const uint64_t new_total = (delta > 0)
      ? it->total_weight + static_cast<uint64_t>(delta)
      : it->total_weight - static_cast<uint64_t>(-delta);

  if (new_total == 0) {
    idx.erase(it);
  } else {
    idx.modify(it, coopname, [&](auto& t) { t.total_weight = new_total; });
  }
}

/**
 * @brief Σ весов по (braname, contract); 0 — распределение не настроено.
 */
uint64_t get_weight_total(eosio::name coopname, eosio::name braname, eosio::name contract) {
  branch_weight_totals_index totals(_branch, coopname.value);
  auto idx = totals.get_index<"bycontrbra"_n>();
  auto it  = idx.find(combine_ids(contract.value, braname.value));
  return it == idx.end() ? 0 : it->total_weight;
}
