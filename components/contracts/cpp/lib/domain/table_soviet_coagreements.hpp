#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: coagreements
 */
struct [[eosio::table, eosio::contract(SOVIET)]] coagreement {
  eosio::name type;
  eosio::name coopname;
  uint64_t program_id;
  uint64_t draft_id;

  uint64_t primary_key() const { return type.value; }
};

typedef eosio::multi_index<"coagreements"_n, coagreement> coagreements_index;

coagreement get_coagreement_or_fail(eosio::name coopname, eosio::name type) {
  coagreements_index coagreements(_soviet, coopname.value);
  auto coagreement_row = coagreements.find(type.value);
  eosio::check(coagreement_row != coagreements.end(), "Соглашение указанного типа не найдено");

  return *coagreement_row;
}

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(coagreement, contract);
