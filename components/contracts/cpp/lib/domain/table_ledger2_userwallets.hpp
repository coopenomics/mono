#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_ledger2_tables
 * @par table: userwallets
 *
 * Третий уровень учёта (L3): пользовательские балансы на USER_SHARED-кошельках
 * (ADR-002, ADR-010). Scope = coopname, payer = coopname (NFR11).
 *
 * Запись существует только пока available + blocked > 0 (auto-create при первом
 * ISSUE/TRANSFER/UNBLOCK на пару `(wallet_name, username)`, auto-delete при
 * обнулении). L3 разрешён только для `kind == USER_SHARED` — гарантируется
 * walletop-логикой и реестром LEDGER2_WALLET_REGISTRY.
 *
 * Инвариант (Story 3.2 / Эпик 3): Σ L3.available по wallet_name == L2.available
 * для этого wallet_name; то же для blocked. Контрактный assert в walletop
 * post-mutation; нарушение откатывает всю tx.
 */
struct [[eosio::table, eosio::contract(LEDGER2)]] userwallet {
  uint64_t      id;
  eosio::name   wallet_name;
  eosio::name   username;
  eosio::asset  available;
  eosio::asset  blocked;

  uint64_t  primary_key()    const { return id; }
  uint128_t by_userwallet()  const { return combine_ids(wallet_name.value, username.value); }
  uint64_t  by_user()        const { return username.value; }
  uint64_t  by_wallet()      const { return wallet_name.value; }

  bool is_empty() const { return available.amount == 0 && blocked.amount == 0; }
};

typedef eosio::multi_index<
    "userwallets"_n, userwallet,
    eosio::indexed_by<"byuserwallet"_n, eosio::const_mem_fun<userwallet, uint128_t, &userwallet::by_userwallet>>,
    eosio::indexed_by<"byuser"_n,       eosio::const_mem_fun<userwallet, uint64_t,  &userwallet::by_user>>,
    eosio::indexed_by<"bywallet"_n,     eosio::const_mem_fun<userwallet, uint64_t,  &userwallet::by_wallet>>>
    userwallets_index;
