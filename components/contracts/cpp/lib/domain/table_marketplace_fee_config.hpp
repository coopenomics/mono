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

// Отсечка персонального распределения per-КУ (branchsplits/setsplit) удалена
// раундом 5 (решение владельца 2026-06-10): при финализации 100% взноса
// уходит в общий кошелёк КУ (branch::accrue), распределение доверенным —
// ручная команда председателя branch::distribute с произвольной суммой.
