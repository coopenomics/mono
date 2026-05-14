#pragma once

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <vector>

#include "../consts.hpp"

namespace WalletTables {

using namespace eosio;

/**
 * @ingroup public_tables
 * @par sub: program_agreement
 *
 * Запись о подписанном программном соглашении пайщика. Хранится без полного
 * текста документа — только хэш и метаданные. Полный текст лежит в action data
 * `wallet::signagree` (audit trail) и в off-chain реестре документов.
 */
struct program_agreement {
  uint64_t      program_id;
  checksum256   doc_hash;
  uint16_t      version;
  uint64_t      draft_id;
  time_point    signed_at;
};

/**
 * @ingroup public_tables
 * @par table: users
 *
 * Owner программных соглашений пайщика (ADR-008). Scope = coopname,
 * payer = coopname. `programs[]` — vector активных программных соглашений
 * (без хард-лимита, эмпирически — единицы программ на пайщика).
 */
struct [[eosio::table, eosio::contract(WALLET)]] user {
  name                            username;
  std::vector<program_agreement>  programs;

  uint64_t primary_key() const { return username.value; }
};

typedef multi_index<"users"_n, user> users_index;

} // namespace WalletTables
