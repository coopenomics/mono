#pragma once

#include <optional>

#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: participants
 */
struct [[eosio::table, eosio::contract(SOVIET)]] participant {
  eosio::name username;
  eosio::time_point_sec created_at;
  eosio::time_point_sec last_update;
  eosio::time_point_sec last_min_pay;

  eosio::name status;

  bool is_initial = true;
  bool is_minimum = true;
  bool has_vote = true;

  eosio::binary_extension<eosio::name> type;
  eosio::binary_extension<eosio::name> braname;

  eosio::binary_extension<eosio::asset> initial_amount;
  eosio::binary_extension<eosio::asset> minimum_amount;

  uint64_t primary_key() const { return username.value; }

  uint64_t bylastpay() const { return last_min_pay.sec_since_epoch(); }

  uint64_t by_created_at() const { return created_at.sec_since_epoch(); }

  bool is_active() const { return status == "accepted"_n; }

  uint64_t by_braname() const { return braname.has_value() ? braname->value : 0; }
};

typedef eosio::multi_index<
    "participants"_n, participant,
    eosio::indexed_by<"bylastpay"_n, eosio::const_mem_fun<participant, uint64_t, &participant::bylastpay>>,
    eosio::indexed_by<"createdat"_n, eosio::const_mem_fun<participant, uint64_t, &participant::by_created_at>>,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<participant, uint64_t, &participant::by_braname>>>
    participants_index;

/// Кооперативный участок, к которому прикреплён пайщик; пусто — пайщик не
/// найден или ни к какому участку не прикреплён. Общее чтение таблицы
/// пайщиков совета для других контрактов (задача 99D-16).
inline std::optional<eosio::name> get_participant_branch(eosio::name coopname, eosio::name username) {
  participants_index participants(_soviet, coopname.value);
  auto it = participants.find(username.value);
  if (it == participants.end() || !it->braname.has_value()) return std::nullopt;
  const eosio::name braname = it->braname.value();
  if (braname == eosio::name{}) return std::nullopt;
  return braname;
}
