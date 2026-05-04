#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_ledger2_tables
 * @par table: wallets (ledger2)
 *
 * @brief Кошелёк управленческого учёта ledger2.
 *
 * Идентификатор — `eosio::name` с префиксом `w.<contract>.<waltype>`
 * (см. `lib/core/ledger2/wallets.hpp::LEDGER2_WALLET_REGISTRY`). Поле `name` —
 * человекочитаемое отображение из реестра. Запись создаётся upsert-ом
 * при первом ISSUE/TRANSFER на кошелёк и удаляется, когда
 * available == 0 && blocked == 0. Писем «writeoff» не существует —
 * все выплаты моделируются как TRANSFER в кошельки-накопители.
 */
struct [[eosio::table, eosio::contract(LEDGER2)]] wallet2 {
  eosio::name  id;
  std::string  name;
  eosio::asset available;
  eosio::asset blocked;

  uint64_t primary_key() const { return id.value; }

  bool is_empty() const {
    return available.amount == 0 && blocked.amount == 0;
  }

  eosio::asset get_total() const { return available + blocked; }
};

typedef eosio::multi_index<"wallets"_n, wallet2> wallets2_index;
