#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"
#include "document_core.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_draft_tables
 * @par scope: scope (кооператив или _draft)
 * @par table: drafts
 */
struct [[eosio::table, eosio::contract(DRAFT)]] onedraft {
  uint64_t registry_id;
  uint64_t version;
  uint64_t default_translation_id;
  std::string title;
  std::string description;
  std::string context;
  std::string model;

  uint64_t primary_key() const { return registry_id; }
};

typedef eosio::multi_index<"drafts"_n, onedraft> drafts_index;

onedraft get_scoped_draft_by_registry_or_fail(eosio::name scope, uint64_t draft_id) {
  drafts_index drafts(_draft, scope.value);
  auto draft = drafts.find(draft_id);

  eosio::check(draft != drafts.end(), "Шаблон документа не найден");

  return *draft;
}

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(onedraft, system);
