#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "../core/document.hpp"
#include "../core/utils.hpp"

namespace Marketplace {

using namespace eosio;

/**
 * @brief Статусы Order'а в процессе p.mkt.supply.
 *
 * Граф: ∅ → active → cancelled (canceled by orderer | expirecycle | declinebatch)
 *                  → accepted → ship_ready → supply_prepared → accepted_to_coop
 *                                                            → ready_to_receive → received
 *
 * Источник правды — `p.mkt.supply.standard.yaml` секция `states:`.
 */
namespace OrderStatus {
  inline constexpr eosio::name ACTIVE           = "active"_n;
  inline constexpr eosio::name CANCELLED        = "cancelled"_n;
  inline constexpr eosio::name ACCEPTED         = "accepted"_n;
  inline constexpr eosio::name SHIP_READY       = "shipready"_n;
  inline constexpr eosio::name SUPPLY_PREPARED  = "supplyprep"_n;
  inline constexpr eosio::name ACCEPTED_TO_COOP = "acceptcoop"_n;
  inline constexpr eosio::name READY_TO_RECEIVE = "readyrecv"_n;
  inline constexpr eosio::name RECEIVED         = "received"_n;
}

/**
 * @brief Тип цикла отсечки заявок поставщика (атрибут Offer'а — Locked Decision L11).
 *
 * Сохраняется на Order'е, потому что фактический cycle_type фиксируется в момент
 * createorder и не меняется при последующем редактировании Offer'а поставщиком.
 */
namespace CycleType {
  inline constexpr eosio::name TIME_BASED        = "timebased"_n;
  inline constexpr eosio::name VOLUME_BASED      = "volumebased"_n;
  inline constexpr eosio::name OPEN_SUBSCRIPT    = "opensubscr"_n;
  inline constexpr eosio::name INDIVIDUAL        = "individual"_n;
}

/**
 * @brief On-chain Order — анкер процесса p.mkt.supply.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `order.hash` — этот hash используется как `process_hash` во всех ledger2-
 * операциях процесса (BLOCK/UNBLOCK/PURCH/PAYOUT/CONSUM/CONSUM2/RETURN).
 *
 * `acceptance_act` (АПП приёмки) и `issue_act` (АПП выдачи) хранятся
 * полным document2 — это дублирование в случае batch-поставки (один
 * физический акт → копия в каждом order'е batch'а), но это допустимо для
 * on-chain (минимум данных + hash) и упрощает аудит.
 *
 * `batch_hash` — opaque ссылка на off-chain consolidated request (Locked
 * Decision L10: batch — backend-only сущность). Контракт не валидирует
 * существование batch'а, только хранит ссылку для трассировки и для
 * фильтрации orders по batch_hash при acceptbatch / declinebatch / prepship /
 * signsupp / signchair (контракт принимает vector<order_hash> или
 * batch_hash + сам собирает соответствующие orders).
 *
 * `actual_quantity` / `fact_cost` заполняются на signiss2 (Story 6.2/6.3).
 * До signiss2 равны соответственно `quantity` / `total_cost`.
 *
 * `warranty_until` — рассчитывается в signiss2 как `received_at + warranty_period_secs`
 * (period приходит с Offer'а через backend в `submretrn` валидируется только это поле).
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] order {
  uint64_t id;                                                ///< внутренний ID
  checksum256 hash;                                           ///< process_hash для p.mkt.supply
  eosio::name coopname;                                       ///< scope-валидация
  eosio::name orderer;                                        ///< пайщик-заказчик
  eosio::name ku_chairman;                                    ///< председатель КУ выдачи (точка маршрутизации signiss1/signiss2/aprretrem)
  checksum256 offer_hash;                                     ///< ссылка на Offer (off-chain в backend)
  eosio::name offerer;                                        ///< пайщик-поставщик из Offer'а (для acceptbatch/declinebatch/prepship/signsupp guard'а)

  uint64_t quantity = 0;                                      ///< заказанное количество
  uint64_t actual_quantity = 0;                               ///< фактически выданное (signiss2); до signiss2 == quantity
  eosio::asset unit_price = asset(0, _root_govern_symbol);    ///< цена за единицу
  eosio::asset total_cost = asset(0, _root_govern_symbol);    ///< quantity * unit_price (заблокированная сумма)
  eosio::asset fact_cost  = asset(0, _root_govern_symbol);    ///< actual_quantity * unit_price (после signiss2)

  eosio::name cycle_type = CycleType::TIME_BASED;             ///< снимок cycle_type Offer'а на момент createorder
  uint32_t warranty_period_secs = 0;                          ///< из Offer'а — для submretrn гард'а
  time_point_sec warranty_until = time_point_sec(0);          ///< received_at + warranty_period_secs (заполняется в signiss2)

  eosio::name status = OrderStatus::ACTIVE;                   ///< canonical статус
  checksum256 batch_hash;                                     ///< opaque ссылка на consolidated request (off-chain)

  document2 acceptance_act_signsupp;                          ///< АПП приёмки — первая подпись поставщика (signsupp)
  document2 acceptance_act_signchair;                         ///< АПП приёмки — финальная подпись председателя (signchair)
  document2 issue_act_signiss1;                               ///< АПП выдачи — первая подпись председателя (signiss1)
  document2 issue_act_signiss2;                               ///< АПП выдачи — финальная подпись заказчика (signiss2)

  uint64_t return_request_id = 0;                             ///< 0 если активного гарантийного возврата нет

  time_point_sec created_at  = time_point_sec(0);
  time_point_sec accepted_at = time_point_sec(0);
  time_point_sec shipped_at  = time_point_sec(0);             ///< signsupp
  time_point_sec received_to_coop_at = time_point_sec(0);     ///< signchair
  time_point_sec ready_at    = time_point_sec(0);             ///< signiss1
  time_point_sec received_at = time_point_sec(0);             ///< signiss2 (= start гарантийного окна)
  time_point_sec cancelled_at = time_point_sec(0);

  uint64_t primary_key()       const { return id; }
  checksum256 by_hash()        const { return hash; }
  uint64_t by_orderer()        const { return orderer.value; }
  uint64_t by_offerer()        const { return offerer.value; }
  uint64_t by_status()         const { return status.value; }
  checksum256 by_batch()       const { return batch_hash; }
  checksum256 by_offer()       const { return offer_hash; }
  uint64_t by_ku_chairman()    const { return ku_chairman.value; }
  uint64_t by_created()        const { return created_at.sec_since_epoch(); }
};

typedef eosio::multi_index<
    "orders"_n, order,
    eosio::indexed_by<"byhash"_n,       eosio::const_mem_fun<order, checksum256, &order::by_hash>>,
    eosio::indexed_by<"byorderer"_n,    eosio::const_mem_fun<order, uint64_t,    &order::by_orderer>>,
    eosio::indexed_by<"byofferer"_n,    eosio::const_mem_fun<order, uint64_t,    &order::by_offerer>>,
    eosio::indexed_by<"bystatus"_n,     eosio::const_mem_fun<order, uint64_t,    &order::by_status>>,
    eosio::indexed_by<"bybatch"_n,      eosio::const_mem_fun<order, checksum256, &order::by_batch>>,
    eosio::indexed_by<"byoffer"_n,      eosio::const_mem_fun<order, checksum256, &order::by_offer>>,
    eosio::indexed_by<"bykuchair"_n,    eosio::const_mem_fun<order, uint64_t,    &order::by_ku_chairman>>,
    eosio::indexed_by<"bycreated"_n,    eosio::const_mem_fun<order, uint64_t,    &order::by_created>>>
    orders_index;

} // namespace Marketplace
