#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @brief Раунд ручного распределения средств общего кошелька КУ между
 * председателем и доверенными (requirement b6 «Экономика КУ», раунд 5;
 * процесс p.brn.fees).
 *
 * Распределение — отдельная команда председателя КУ (НЕ автоматическое при
 * финализации заказа): он указывает сумму из общего кошелька, она
 * раскладывается по весам реестра `weights`. Можно распределять не всё и
 * несколько раз. Запись раунда — источник истории распределений для UI и
 * якорь process_hash для ledger2-операций o.brn.release / o.brn.person.
 *
 * `distributed` ≤ `amount`: целочисленные доли округляются вниз, остаток
 * округления не покидает общий кошелёк (o.brn.release выполняется только
 * на фактически разданное).
 *
 * scope = coopname; primary_key = id; уникальность по hash через `byhash`.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: rounds
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_round {
  uint64_t              id;           ///< суррогатный ключ (scope coopname)
  eosio::checksum256    hash;         ///< идентификатор раунда (= process_hash ledger2-операций распределения)
  eosio::name           braname;      ///< кооперативный участок
  eosio::name           contract;     ///< контракт-источник реестра весов (например marketplace)
  eosio::asset          amount;       ///< сумма, заявленная председателем к распределению
  eosio::asset          distributed;  ///< фактически роздано по весам (остаток округления остался в общем кошельке)
  eosio::time_point_sec created_at;   ///< момент распределения

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
  uint64_t by_branch() const { return braname.value; }
};

typedef eosio::multi_index<
    "rounds"_n, branch_round,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<branch_round, eosio::checksum256, &branch_round::by_hash>>,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<branch_round, uint64_t, &branch_round::by_branch>>>
    branch_rounds_index;
