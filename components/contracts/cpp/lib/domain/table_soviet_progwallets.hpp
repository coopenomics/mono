#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: progwallets
 */
struct [[eosio::table, eosio::contract(SOVIET)]] progwallet {
  uint64_t id;
  eosio::name coopname;
  uint64_t program_id;
  uint64_t agreement_id;
  eosio::name username;
  eosio::asset available;
  eosio::binary_extension<eosio::asset> blocked;
  eosio::binary_extension<eosio::asset> membership_contribution;

  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  uint64_t by_program() const { return program_id; }
  uint64_t by_agreement() const { return agreement_id; }

  uint128_t by_username_and_program() const {
    return combine_ids(username.value, program_id);
  }
};

typedef eosio::multi_index<
    "progwallets"_n, progwallet,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<progwallet, uint64_t, &progwallet::by_username>>,
    eosio::indexed_by<"byprogram"_n, eosio::const_mem_fun<progwallet, uint64_t, &progwallet::by_program>>,
    eosio::indexed_by<"byuserprog"_n,
                     eosio::const_mem_fun<progwallet, uint128_t, &progwallet::by_username_and_program>>,
    eosio::indexed_by<"byagreement"_n, eosio::const_mem_fun<progwallet, uint64_t, &progwallet::by_agreement>>>
    progwallets_index;

progwallet get_user_program_wallet_or_fail(eosio::name coopname, eosio::name username, uint64_t program_id) {
  progwallets_index progwallets(_soviet, coopname.value);

  auto wallets_by_username_and_program = progwallets.template get_index<"byuserprog"_n>();
  auto username_and_program_index = combine_ids(username.value, program_id);
  auto wallet = wallets_by_username_and_program.find(username_and_program_index);

  eosio::check(wallet != wallets_by_username_and_program.end(), "Кошелёк не найден");

  return *wallet;
}

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(progwallet, contract);
