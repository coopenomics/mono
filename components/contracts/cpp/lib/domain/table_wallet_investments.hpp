#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"

namespace WalletTables {

using namespace eosio;

/**
 * @ingroup public_tables
 * @par table: investments
 *
 * Заявка кооператива на инвестирование собственных средств (расчётный счёт)
 * в целевую потребительскую программу кооператива-оператора платформы
 * (ЦПП «Благорост» ПК «ВОСХОД»). Процесс: заявление председателя →
 * решение совета → исходящий платёж в gateway → подтверждение кассиром →
 * проводка Дт 58 / Кт 51 (o.wal.invcpl).
 */
struct [[eosio::table, eosio::contract(WALLET)]] investment {
  uint64_t id;
  name coopname;
  checksum256 invest_hash;
  name status;

  asset quantity;
  document2 statement;
  document2 approved_statement;
  document2 authorization;

  eosio::time_point_sec created_at = current_time_point();

  uint64_t primary_key() const { return id; }
  checksum256 by_hash() const { return invest_hash; }
  uint64_t by_status() const { return status.value; }
  uint64_t by_created() const { return created_at.sec_since_epoch(); }
};

typedef multi_index<
    "investments"_n, investment,
    indexed_by<"byhash"_n, const_mem_fun<investment, checksum256, &investment::by_hash>>,
    indexed_by<"bystatus"_n, const_mem_fun<investment, uint64_t, &investment::by_status>>,
    indexed_by<"bycreated"_n, const_mem_fun<investment, uint64_t, &investment::by_created>>>
    investments_index;

} // namespace WalletTables
