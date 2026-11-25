#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @brief Фонд накопления кооператива.
 *
 * Три фонда стандартны и заводятся у каждого кооператива при старте
 * (`fund::init`): неделимый 1 %, резервный 15 %, фонд развития кооперации 5 %.
 * Совет вправе завести дополнительные (`createfund`). Процент — доля
 * членского взноса, которая отчисляется в фонд (`HUNDR_PERCENTS` = 100 %).
 *
 * С задачи 99D-19 (КЭУ-1, решение владельца 02.11.2026) остатки фондов
 * ведутся в ledger2 на кошельке `w.fnd.accum` с разрезом по имени фонда:
 * поле `wallet_name` — ключ этого разреза. Поля `available` и `withdrawed`
 * остаются зеркалом для прежних экранов совета и заполняются тем же
 * действием `fund::accrue`.
 *
 * @ingroup public_tables
 * @ingroup public_fund_tables
 * @par table: accfunds
 */
struct [[eosio::table, eosio::contract(FUND)]] accfund {
  uint64_t id;
  eosio::name coopname;
  eosio::name contract;

  std::string name;
  std::string description;

  uint64_t percent;
  eosio::asset available;
  eosio::asset withdrawed;

  /// Имя разреза кошелька `w.fnd.accum` в ledger2. У стандартных фондов
  /// постоянно (`indivisible`, `reserve`, `develop`), у дополнительных строится
  /// контрактом из идентификатора (`Fund::wallet_name_for_id`). Строки, заведённые
  /// до задачи 99D-19, значения не имеют — имя для них строится так же.
  eosio::binary_extension<eosio::name> wallet_name;

  uint64_t primary_key() const { return id; }
};

typedef eosio::multi_index<"accfunds"_n, accfund> accfunds_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(accfund, contract);
