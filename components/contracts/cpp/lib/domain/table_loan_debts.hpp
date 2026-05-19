#pragma once

#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

namespace Loan {

using namespace eosio;

struct [[eosio::table, eosio::contract(LOAN)]] debt {
  uint64_t id;
  name coopname;
  name username;
  checksum256 debt_hash;
  asset amount;
  time_point_sec created_at;
  time_point_sec repaid_at;

  // Привязка займа к проекту/программе вызывающего контракта (для паевого взноса
  // нужно знать, какие займы пайщика гасятся именно по этому проекту).
  // binary_extension: таблица debts уже в продакшене (но пустая), новые поля только хвостом.
  binary_extension<checksum256> project_hash;

  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  checksum256 by_debt_hash() const { return debt_hash; }
  uint64_t by_created() const { return created_at.sec_since_epoch(); }
  uint64_t by_repaid() const { return repaid_at.sec_since_epoch(); }
  uint128_t by_user_project() const {
    checksum256 ph = project_hash.has_value() ? *project_hash : checksum256{};
    auto p_bytes = ph.extract_as_byte_array();
    uint64_t hi = (uint64_t)p_bytes[0] << 56 | (uint64_t)p_bytes[1] << 48
                | (uint64_t)p_bytes[2] << 40 | (uint64_t)p_bytes[3] << 32
                | (uint64_t)p_bytes[4] << 24 | (uint64_t)p_bytes[5] << 16
                | (uint64_t)p_bytes[6] << 8  | (uint64_t)p_bytes[7];
    return ((uint128_t)hi << 64) | username.value;
  }
};

typedef multi_index<
    "debts"_n, debt,
    indexed_by<"byusername"_n, const_mem_fun<debt, uint64_t, &debt::by_username>>,
    indexed_by<"bydebthash"_n, const_mem_fun<debt, checksum256, &debt::by_debt_hash>>,
    indexed_by<"bycreated"_n, const_mem_fun<debt, uint64_t, &debt::by_created>>,
    indexed_by<"byrepaid"_n, const_mem_fun<debt, uint64_t, &debt::by_repaid>>,
    indexed_by<"byuserproj"_n, const_mem_fun<debt, uint128_t, &debt::by_user_project>>>
    debts_index;

} // namespace Loan
