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
 * @par table: wjournal (ledger2)
 *
 * @brief Журнал операций по кошелькам ledger2 (wallet-level).
 *
 * На каждый успешный ledger2::apply создаётся ровно одна запись,
 * описывающая атомарное движение кошельков:
 *   - ISSUE    (wallet_to получает amount)
 *   - TRANSFER (wallet_from → wallet_to на amount)
 *   - BLOCK    (wallet_from: available → blocked на amount)
 *   - UNBLOCK  (wallet_from: blocked → available на amount)
 *
 * Линки на action_code и journal_entry_id позволяют сверять движение
 * кошелька с парной бухгалтерской проводкой в таблице journal.
 */
struct [[eosio::table, eosio::contract(LEDGER2)]] wjournal_entry {
  uint64_t             id;
  uint8_t              wallet_op;          ///< WalletOp: 0=ISSUE, 1=TRANSFER, 2=BLOCK, 3=UNBLOCK
  uint64_t             wallet_from;        ///< 0 для ISSUE
  uint64_t             wallet_to;          ///< 0 для BLOCK/UNBLOCK
  eosio::asset         amount;
  eosio::name          action_code;
  uint64_t             journal_entry_id;   ///< id парной бухгалтерской проводки
  eosio::name          username;
  std::string          memo;
  eosio::checksum256   document_hash;
  eosio::time_point    created_at;

  uint64_t primary_key() const { return id; }
  uint64_t by_op() const { return wallet_op; }
  uint64_t by_from() const { return wallet_from; }
  uint64_t by_to() const { return wallet_to; }
  uint64_t by_action() const { return action_code.value; }
  uint64_t by_user() const { return username.value; }
  uint64_t by_journal() const { return journal_entry_id; }
  uint64_t by_created() const { return static_cast<uint64_t>(created_at.elapsed.count()); }
};

typedef eosio::multi_index<
  "wjournal"_n, wjournal_entry,
  eosio::indexed_by<"byop"_n,      eosio::const_mem_fun<wjournal_entry, uint64_t, &wjournal_entry::by_op>>,
  eosio::indexed_by<"byfrom"_n,    eosio::const_mem_fun<wjournal_entry, uint64_t, &wjournal_entry::by_from>>,
  eosio::indexed_by<"byto"_n,      eosio::const_mem_fun<wjournal_entry, uint64_t, &wjournal_entry::by_to>>,
  eosio::indexed_by<"byaction"_n,  eosio::const_mem_fun<wjournal_entry, uint64_t, &wjournal_entry::by_action>>,
  eosio::indexed_by<"byuser"_n,    eosio::const_mem_fun<wjournal_entry, uint64_t, &wjournal_entry::by_user>>,
  eosio::indexed_by<"byjournal"_n, eosio::const_mem_fun<wjournal_entry, uint64_t, &wjournal_entry::by_journal>>,
  eosio::indexed_by<"bycreated"_n, eosio::const_mem_fun<wjournal_entry, uint64_t, &wjournal_entry::by_created>>
> wjournal_index;
