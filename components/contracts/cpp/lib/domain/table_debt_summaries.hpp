#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

namespace Debt {

using namespace eosio;

/**
 * @brief Общий долг пайщика по выданным беспроцентным займам.
 * @ingroup public_debt_tables
 *
 * @par Область памяти (scope): coopname
 * @par Имя таблицы (table): summaries
 *
 * Сумма остатков всех выданных займов пайщика из всех источников. Запись
 * удаляется при обнулении.
 */
struct [[eosio::table, eosio::contract(DEBT_CONTRACT)]] summary {
  name  username; ///< Пайщик
  asset total;    ///< Остаток к возврату по всем займам

  uint64_t primary_key() const { return username.value; }
};

typedef multi_index<"summaries"_n, summary> summaries_index;

} // namespace Debt

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Debt::summary, contract);
