#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

#include "../consts.hpp"

/**
 * @brief Ставка обеспечительной части паевого взноса «Стола заказов»
 * (задача 99D-18; имя поля `membership_fee_percent` — историческое).
 *
 * Ставка — ЕДИНАЯ на весь кооператив (не per-КУ и не per-категория): одна и
 * та же обеспечительная часть вне зависимости от того, на какой кооперативный
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
  uint64_t membership_fee_percent = 0;  ///< ставка обеспечительной части паевого взноса от стоимости заказа (HUNDR_PERCENTS = 100%)
};

typedef eosio::singleton<"config"_n, mkt_config> mkt_config_singleton;

// Отсечка персонального распределения per-КУ (branchsplits/setsplit) удалена
// раундом 5 (решение владельца 2026-06-10): при списании обеспечительной
// части по условиям ЦПП вся сумма зачисляется в общий кошелёк КУ
// (chargedue → branch::accrue), распределение доверенным — ручная команда
// председателя branch::distribute с произвольной суммой.

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(mkt_config, contract);
