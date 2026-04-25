#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "../core/document.hpp"
#include "../core/utils.hpp"
#include "document_core.hpp"

namespace Marketplace {

using namespace eosio;

struct [[eosio::table, eosio::contract(MARKETPLACE)]] request {
  uint64_t id;
  checksum256 hash;
  name coopname;
  name type;
  name status;
  name username;
  name braname;
  name warehouse;
  name token_contract;

  name receiver_braname;
  name supplier_braname;

  asset unit_cost;
  asset base_cost;
  asset membership_fee_amount;
  asset total_cost;

  uint64_t units;
  std::string meta;

  name money_contributor;
  name product_contributor;

  std::vector<Document::named_document> documents;

  uint64_t product_lifecycle_secs;
  uint64_t warranty_period_secs;
  asset cancellation_fee_amount;

  time_point_sec warranty_delay_until;
  time_point_sec deadline_for_receipt;

  name delivery_type;     /*!< тип доставки: "internal" (между КУ) или "external" (внешний сервис) */
  name contribution_type; /*!< тип взноса: "share" (паевой) или "member" (членский — кооператив покупает) */

  bool is_warranty_return = false;
  uint64_t warranty_return_id;

  time_point_sec created_at;
  time_point_sec accepted_at;
  time_point_sec supplied_at;
  time_point_sec delivered_at;
  time_point_sec received_at;
  time_point_sec completed_at;
  time_point_sec declined_at;
  time_point_sec disputed_at;
  time_point_sec canceled_at;

  uint64_t primary_key() const { return id; }
  uint64_t by_coop() const { return coopname.value; }
  uint64_t by_status() const { return status.value; }
  uint64_t by_type() const { return type.value; }
  checksum256 by_hash() const { return hash; }
  uint64_t by_username() const { return username.value; }

  uint64_t by_created() const { return created_at.sec_since_epoch(); }
  uint64_t by_completed() const { return completed_at.sec_since_epoch(); }
  uint64_t by_declined() const { return declined_at.sec_since_epoch(); }
  uint64_t by_canceled() const { return canceled_at.sec_since_epoch(); }
  uint64_t by_warranty_id() const { return warranty_return_id; }

  name get_money_contributor() const {
    return is_warranty_return ? product_contributor : money_contributor;
  }

  name get_product_contributor() const {
    return is_warranty_return ? money_contributor : product_contributor;
  }

  name get_payer() const { return get_money_contributor(); }

  name get_supplier() const { return get_product_contributor(); }

  name get_product_backer() const { return money_contributor; }

  name get_defective_supplier() const { return product_contributor; }
};

typedef eosio::multi_index<
    "requests"_n, request,
    eosio::indexed_by<"bycoop"_n, eosio::const_mem_fun<request, uint64_t, &request::by_coop>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<request, uint64_t, &request::by_status>>,
    eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<request, uint64_t, &request::by_type>>,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<request, checksum256, &request::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<request, uint64_t, &request::by_username>>,
    eosio::indexed_by<"bycreated"_n, eosio::const_mem_fun<request, uint64_t, &request::by_created>>,
    eosio::indexed_by<"bycompleted"_n, eosio::const_mem_fun<request, uint64_t, &request::by_completed>>,
    eosio::indexed_by<"bydeclined"_n, eosio::const_mem_fun<request, uint64_t, &request::by_declined>>,
    eosio::indexed_by<"bycanceled"_n, eosio::const_mem_fun<request, uint64_t, &request::by_canceled>>,
    eosio::indexed_by<"bywarrantyid"_n, eosio::const_mem_fun<request, uint64_t, &request::by_warranty_id>>>
    requests_index;

} // namespace Marketplace
