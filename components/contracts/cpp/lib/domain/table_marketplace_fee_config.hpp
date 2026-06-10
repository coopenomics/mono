#pragma once

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

#include "../consts.hpp"

/**
 * @brief Конфигурация членского взноса «Стола заказов» (requirement b6
 * «Экономика КУ»).
 *
 * Ставка — ЕДИНАЯ на весь кооператив (не per-КУ и не per-категория): один и
 * тот же членский взнос вне зависимости от того, на какой кооперативный
 * участок заказ — против спекуляций и конкуренции между участками (решение
 * владельца 2026-06-10). Устанавливает администратор транзакцией setfee.
 *
 * Проценты — в долях HUNDR_PERCENTS (1000000 = 100%), как в фондах и
 * программах совета.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: config
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] mkt_config {
  uint64_t membership_fee_percent = 0;  ///< ставка членского взноса от стоимости заказа (HUNDR_PERCENTS = 100%)
};

typedef eosio::singleton<"config"_n, mkt_config> mkt_config_singleton;

/**
 * @brief Отсечка персонального распределения членского взноса per-КУ:
 * какая доля взноса при финализации заказа распределяется по весам между
 * председателем и доверенными КУ (branch::weights); остальное — в общий
 * кошелёк КУ (w.brn.common). Настраивает председатель КУ (setsplit).
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: branchsplits
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] branch_split {
  eosio::name braname;           ///< кооперативный участок (PK)
  uint64_t    personal_percent;  ///< доля персонального распределения (HUNDR_PERCENTS = 100%)

  uint64_t primary_key() const { return braname.value; }
};

typedef eosio::multi_index<"branchsplits"_n, branch_split> branch_splits_index;
