#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <optional>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "document_core.hpp"

namespace Approver {

using namespace eosio;

struct [[eosio::table, eosio::contract(SOVIET)]] approval {
  uint64_t id;
  name coopname;
  name username;
  name type;
  document2 document;
  checksum256 approval_hash;
  name callback_contract;
  name callback_action_approve;
  name callback_action_decline;
  std::string meta;
  time_point_sec created_at;

  uint64_t primary_key() const { return id; }
  checksum256 by_hash() const { return approval_hash; }
  uint64_t by_username() const { return username.value; }
  uint64_t by_type() const { return type.value; }
};

typedef multi_index<
    "approvals"_n, approval,
    indexed_by<"byhash"_n, const_mem_fun<approval, checksum256, &approval::by_hash>>,
    indexed_by<"byusername"_n, const_mem_fun<approval, uint64_t, &approval::by_username>>,
    indexed_by<"bytype"_n, const_mem_fun<approval, uint64_t, &approval::by_type>>>
    approvals_index;

inline std::optional<approval> get_approval(name coopname, const checksum256 &hash) {
  approvals_index primary_index(_soviet, coopname.value);
  auto secondary_index = primary_index.get_index<"byhash"_n>();

  auto itr = secondary_index.find(hash);
  if (itr == secondary_index.end()) {
    return std::nullopt;
  }

  return *itr;
}

} // namespace Approver

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Approver::approval, cooperative);
