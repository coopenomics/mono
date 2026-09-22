#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"

struct board_member {
  eosio::name username;
  bool is_voting;
  std::string position_title;
  eosio::name position;
};

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: boards
 */
struct [[eosio::table, eosio::contract(SOVIET)]] boards {
  uint64_t id;
  eosio::name type;
  std::string name;
  std::string description;

  std::vector<board_member> members;

  eosio::time_point_sec created_at;
  eosio::time_point_sec last_update;

  uint64_t primary_key() const { return id; }

  uint64_t by_type() const { return type.value; }

  bool is_valid_member(eosio::name member) const {
    for (const auto &m : members) {
      if (m.username == member)
        return true;
    }
    return false;
  }

  bool is_voting_member(eosio::name member) const {
    for (const auto &m : members) {
      if (m.username == member && m.is_voting == true)
        return true;
    }
    return false;
  }

  bool is_valid_chairman(eosio::name chairman) const {
    for (const auto &m : members) {
      if (m.username == chairman && (m.position == "chairman"_n || m.position == "vpchairman"_n))
        return true;
    }
    return false;
  }

  eosio::name get_chairman() const {
    for (const auto &m : members) {
      if (m.position == "chairman"_n)
        return m.username;
    }
    return ""_n;
  }

  bool is_valid_secretary(eosio::name secretary) const {
    for (const auto &m : members) {
      if (m.username == secretary && (m.position == "secretary"_n))
        return true;
    }
    return false;
  }

  bool has_voting_right(eosio::name member) const {
    for (const auto &m : members) {
      if (m.username == member && m.is_voting)
        return true;
    }
    return false;
  }

  uint64_t get_members_count() const { return members.size(); }
};

typedef eosio::multi_index<
    "boards"_n, boards,
    eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<boards, uint64_t, &boards::by_type>>>
    boards_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(boards, contract);
