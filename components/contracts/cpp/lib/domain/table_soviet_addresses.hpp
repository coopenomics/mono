#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

struct address_data {
  std::string full_address;
  std::string latitude;
  std::string longitude;
  std::string country;
  std::string state;
  std::string city;
  std::string district;
  std::string street;
  std::string house_number;
  std::string building_section;
  std::string unit_number;
  std::string directions;
  std::string phone_number;
  std::string email;
  std::string business_hours;
  std::string meta;
};

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: addresses
 */
struct [[eosio::table, eosio::contract(SOVIET)]] address {
  uint64_t id;
  eosio::name coopname;
  eosio::name braname;
  address_data data;

  uint64_t primary_key() const { return id; }
};

typedef eosio::multi_index<"addresses"_n, address> addresses_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(address, contract);
