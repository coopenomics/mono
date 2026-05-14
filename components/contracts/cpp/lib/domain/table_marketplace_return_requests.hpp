#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "../core/document.hpp"
#include "../core/utils.hpp"

namespace Marketplace {

using namespace eosio;

/**
 * @brief Статусы заявления на гарантийный возврат (процесс p.mkt.return).
 *
 * Граф: ∅ → pending_review → approved_for_visit → return_accepted (final)
 *                                              → rejected_at_ku  (final)
 *                          → rejected_remote (final)
 *
 * Источник правды — `p.mkt.return.standard.yaml` секция `states:`.
 */
namespace ReturnStatus {
  inline constexpr eosio::name PENDING_REVIEW       = "pendrev"_n;
  inline constexpr eosio::name APPROVED_FOR_VISIT   = "approvvisit"_n;
  inline constexpr eosio::name RETURN_ACCEPTED      = "accepted"_n;
  inline constexpr eosio::name REJECTED_REMOTE      = "rejremote"_n;
  inline constexpr eosio::name REJECTED_AT_KU       = "rejatku"_n;
}

/**
 * @brief On-chain Заявление на гарантийный возврат — анкер процесса p.mkt.return.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `return_request.hash` — этот hash используется как `process_hash` во всех
 * ledger2-операциях процесса (RETURN + RETURN2).
 *
 * Связь с исходным Order'ом — `original_order_id` + `original_order_hash`;
 * Order.return_request_id ставится в submretrn для двусторонней связи.
 *
 * `photos` — vector<checksum256> хешей файлов в bucket'е stol-zakazov:images
 * (Story 7.1, AR32). Реальные изображения off-chain в file-storage (PR #359);
 * on-chain — только ссылки (hash для дедупликации + URL восстанавливает backend).
 *
 * `decision_remote` / `decision_visit` — декларативные документы решений
 * председателя (rejretrem / accretrn / rejretrn). reason_remote / reason_visit
 * — текстовые причины отказа для пользовательского UI (заполняются в
 * rejretrem / rejretrn соответственно).
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] return_request {
  uint64_t id;
  checksum256 hash;                                           ///< process_hash для p.mkt.return
  eosio::name coopname;
  eosio::name orderer;                                        ///< пайщик-заказчик (заявитель)
  eosio::name ku_chairman;                                    ///< председатель КУ выдачи (decision-maker)

  uint64_t original_order_id;                                 ///< внутренний id Order'а
  checksum256 original_order_hash;                            ///< process_hash оригинального p.mkt.supply
  checksum256 original_consume_op_id;                         ///< ссылка на оригинальный o.mkt.consum (для journal трассировки compensating forward; см. d6 A4)

  uint64_t actual_quantity = 0;                               ///< возвращаемое количество (по умолчанию = order.actual_quantity, может быть меньше)
  eosio::asset fact_cost = asset(0, _root_govern_symbol);     ///< возвращаемая сумма (actual_quantity * unit_price)

  std::string reason_text;                                    ///< причина обращения (≤ 500 символов)
  std::vector<checksum256> photos;                            ///< хеши файлов в bucket'е stol-zakazov:images

  eosio::name status = ReturnStatus::PENDING_REVIEW;
  document2 statement;                                        ///< заявление пайщика (опционально подписанное)
  document2 decision_remote;                                  ///< решение председателя удалённо (aprretrem | rejretrem)
  document2 decision_visit;                                   ///< решение председателя по итогам очного осмотра (accretrn | rejretrn)
  std::string reason_remote;                                  ///< причина отказа удалённо (для rejretrem)
  std::string reason_visit;                                   ///< причина отказа на очном осмотре (для rejretrn)

  time_point_sec created_at  = time_point_sec(0);             ///< submretrn
  time_point_sec reviewed_at = time_point_sec(0);             ///< aprretrem | rejretrem
  time_point_sec resolved_at = time_point_sec(0);             ///< accretrn | rejretrn

  uint64_t primary_key()           const { return id; }
  checksum256 by_hash()            const { return hash; }
  uint64_t by_orderer()            const { return orderer.value; }
  uint64_t by_ku_chairman()        const { return ku_chairman.value; }
  uint64_t by_status()             const { return status.value; }
  uint64_t by_original_order()     const { return original_order_id; }
  uint64_t by_created()            const { return created_at.sec_since_epoch(); }
};

typedef eosio::multi_index<
    "retrequests"_n, return_request,
    eosio::indexed_by<"byhash"_n,        eosio::const_mem_fun<return_request, checksum256, &return_request::by_hash>>,
    eosio::indexed_by<"byorderer"_n,     eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_orderer>>,
    eosio::indexed_by<"bykuchair"_n,     eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_ku_chairman>>,
    eosio::indexed_by<"bystatus"_n,      eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_status>>,
    eosio::indexed_by<"byorigorder"_n,   eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_original_order>>,
    eosio::indexed_by<"bycreated"_n,     eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_created>>>
    return_requests_index;

} // namespace Marketplace
