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
 * @brief Статусы гарантийной претензии поставщику (процесс p.mkt.claim).
 *
 * Граф: ∅ → pending → admitted. По умолчанию поставщик не согласен — претензия
 * остаётся в pending сколько угодно (сумма на кошельке непризнанных претензий,
 * основание для суда); признание переводит сумму в долг, который гасится
 * удержанием из следующих выплат. Запись не стирается.
 */
namespace ClaimStatus {
  inline constexpr eosio::name PENDING  = "pending"_n;   ///< выставлена по решению совета; поставщик не признал
  inline constexpr eosio::name ADMITTED = "admitted"_n;  ///< поставщик признал — долг к удержанию из выплат
}

/**
 * @brief On-chain гарантийная претензия поставщику — анкер процесса p.mkt.claim
 * (компонент 68, задача 99D-13; решение владельца 08.09.2026).
 *
 * Возникает в момент исполнения решения совета об отмене сделки
 * (`onmktrtauth`) по заказу с внешним поставщиком: кооператив уже оплатил
 * имущество, а оно вернулось на склад участка по рекламации пайщика. Претензия
 * несёт рекламацию с двумя подписями (пайщика и оператора участка, принявшего
 * имущество) и сумму, на которую произошёл возврат.
 *
 * scope = coopname; primary_key = id; `hash` = sha256(байты хэша рекламации
 * ‖ "claim") — process_hash всех операций претензии; выводится из хэша
 * рекламации детерминированно, но отличается от него, чтобы нитка претензии в
 * реестре процессов не сливалась с ниткой возврата. Поставщик признаёт
 * претензию `admitclaim`; несогласие в цепь не пишется.
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] warranty_claim {
  uint64_t id;
  checksum256 hash;                                           ///< process_hash для p.mkt.claim = sha256(хэш рекламации ‖ "claim")
  eosio::name coopname;
  eosio::name supplier;                                       ///< поставщик по заказу (order.offerer)
  eosio::name orderer;                                        ///< пайщик, вернувший имущество

  uint64_t original_order_id;                                 ///< внутренний id заказа
  checksum256 original_order_hash;                            ///< process_hash заказа (p.mkt.supply)

  eosio::asset actual_quantity = asset(0, _unit_piece);       ///< возвращённое количество
  eosio::asset amount = asset(0, _root_govern_symbol);        ///< сумма претензии — стоимость возвращённого имущества

  std::string reason_text;                                    ///< причина обращения пайщика (из рекламации)
  std::vector<checksum256> photos;                            ///< хеши фотографий из рекламации
  document2 reclamation;                                      ///< рекламация 1106 с подписями пайщика и оператора участка

  eosio::name status = ClaimStatus::PENDING;
  time_point_sec created_at;                                  ///< момент решения совета
  time_point_sec decided_at;                                  ///< момент признания поставщиком

  uint64_t primary_key()           const { return id; }
  checksum256 by_hash()            const { return hash; }
  uint64_t by_supplier()           const { return supplier.value; }
  uint64_t by_status()             const { return status.value; }
  uint64_t by_original_order()     const { return original_order_id; }
};

typedef eosio::multi_index<
    "claims"_n, warranty_claim,
    eosio::indexed_by<"byhash"_n,        eosio::const_mem_fun<warranty_claim, checksum256, &warranty_claim::by_hash>>,
    eosio::indexed_by<"bysupplier"_n,    eosio::const_mem_fun<warranty_claim, uint64_t,    &warranty_claim::by_supplier>>,
    eosio::indexed_by<"bystatus"_n,      eosio::const_mem_fun<warranty_claim, uint64_t,    &warranty_claim::by_status>>,
    eosio::indexed_by<"byorigorder"_n,   eosio::const_mem_fun<warranty_claim, uint64_t,    &warranty_claim::by_original_order>>>
    warranty_claims_index;

} // namespace Marketplace
