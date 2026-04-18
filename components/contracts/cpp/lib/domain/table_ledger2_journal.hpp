#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_ledger2_tables
 * @par table: journal (ledger2)
 *
 * @brief Журнал проводок бухгалтерских счетов ledger2 (account-level,
 *        двойная запись).
 *
 * На каждый успешный ledger2::apply создаётся ровно одна запись —
 * пара (debit_account_id, credit_account_id) на сумму amount.
 * Запись линкуется с парной операцией кошелька в таблице wjournal
 * через wjournal_entry_id.
 *
 * Инвариант: для любого диапазона дат Σ amount (по всем записям) равна
 * Σ amount (тот же набор) — записи Dr/Cr идут парами, сумма одна,
 * поэтому totalDebit == totalCredit всегда.
 *
 * Поля `process_type` и `process_hash` дублируют соответствующие поля
 * wjournal — это единый семантический ключ процесса.
 */
struct [[eosio::table, eosio::contract(LEDGER2)]] journal_entry {
  uint64_t             id;
  uint64_t             debit_account_id;
  uint64_t             credit_account_id;
  eosio::asset         amount;
  eosio::name          action_code;
  uint64_t             wjournal_entry_id;  ///< id парной записи в wjournal
  eosio::name          process_type;       ///< тип процесса (из ACTION_REGISTRY)
  eosio::checksum256   process_hash;       ///< entity-hash процесса
  std::string          memo;
  eosio::time_point    created_at;

  uint64_t primary_key() const { return id; }
  uint64_t by_debit() const { return debit_account_id; }
  uint64_t by_credit() const { return credit_account_id; }
  uint64_t by_action() const { return action_code.value; }
  uint64_t by_wjournal() const { return wjournal_entry_id; }
  uint64_t by_process_type() const { return process_type.value; }
  eosio::checksum256 by_process_hash() const { return process_hash; }
  uint64_t by_created() const { return static_cast<uint64_t>(created_at.elapsed.count()); }
};

typedef eosio::multi_index<
  "journal"_n, journal_entry,
  eosio::indexed_by<"bydebit"_n,    eosio::const_mem_fun<journal_entry, uint64_t, &journal_entry::by_debit>>,
  eosio::indexed_by<"bycredit"_n,   eosio::const_mem_fun<journal_entry, uint64_t, &journal_entry::by_credit>>,
  eosio::indexed_by<"byaction"_n,   eosio::const_mem_fun<journal_entry, uint64_t, &journal_entry::by_action>>,
  eosio::indexed_by<"bywjournal"_n, eosio::const_mem_fun<journal_entry, uint64_t, &journal_entry::by_wjournal>>,
  eosio::indexed_by<"byproctype"_n, eosio::const_mem_fun<journal_entry, uint64_t, &journal_entry::by_process_type>>,
  eosio::indexed_by<"byprochash"_n, eosio::const_mem_fun<journal_entry, eosio::checksum256, &journal_entry::by_process_hash>>,
  eosio::indexed_by<"bycreated"_n,  eosio::const_mem_fun<journal_entry, uint64_t, &journal_entry::by_created>>
> journal_index;
