#pragma once

#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_ledger2_tables
 * @par table: meta (ledger2, scope = _ledger2)
 *
 * @brief Singleton-таблица ledger2 для системных флагов
 * (в частности — завершённости миграции с ledger).
 */
struct [[eosio::table, eosio::contract(LEDGER2)]] ledger2_meta {
  uint64_t          id;                        // всегда 0
  bool              migrated;                  // полный прогон миграции завершён
  uint64_t          migrated_coops;            // всего кооп обработано
  uint64_t          last_migrated_coop_index;  // последний обработанный индекс (для курсора)
  eosio::time_point migrated_at;               // время последнего прогона

  uint64_t primary_key() const { return id; }
};

typedef eosio::multi_index<"meta"_n, ledger2_meta> ledger2_meta_index;
