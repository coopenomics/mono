#pragma once

#include <functional>
#include <optional>
#include <string>

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"
#include "../../domain/document_core.hpp"
#include "../../domain/table_ledger2_userwallets.hpp"
#include "../../domain/table_marketplace_orders.hpp"
#include "../../domain/table_marketplace_return_requests.hpp"
#include "../../domain/table_marketplace_writeoff_proposals.hpp"

/**
 * @brief Canonical helpers контракта marketplace (Story 11.1).
 *
 * Donor-helpers (`get_request_by_hash`, `get_shipment_by_hash`, namespace
 * `DocumentNames`, `marketplace_callback_actions`) удалены вместе с
 * соответствующими actions и таблицами (AR30).
 *
 * Этот файл содержит только утилиты доступа к canonical-сущностям трёх
 * процессов p.mkt.supply / p.mkt.return / p.mkt.wroff и helper'ы для
 * проверки доступного баланса (для createorder guard'а Locked Decision L6).
 */
namespace Marketplace {

using namespace eosio;

// ── Orders ──────────────────────────────────────────────────────────────

inline std::optional<order> get_order_by_hash(eosio::name coopname, const checksum256& order_hash) {
  orders_index orders(_marketplace, coopname.value);
  auto idx = orders.get_index<"byhash"_n>();
  auto it = idx.find(order_hash);
  if (it == idx.end()) return std::nullopt;
  return *it;
}

inline order get_order_by_hash_or_fail(eosio::name coopname, const checksum256& order_hash,
                                       const std::string& msg = "Заказ не найден по хэшу") {
  auto o = get_order_by_hash(coopname, order_hash);
  eosio::check(o.has_value(), msg);
  return *o;
}

inline void update_order(eosio::name coopname, uint64_t order_id, const std::function<void(order&)>& fn) {
  orders_index orders(_marketplace, coopname.value);
  auto it = orders.find(order_id);
  eosio::check(it != orders.end(), "Заказ не найден по id");
  orders.modify(it, _marketplace, [&](auto& o) { fn(o); });
}

// ── Return requests ─────────────────────────────────────────────────────

inline std::optional<return_request> get_return_request_by_hash(eosio::name coopname,
                                                                 const checksum256& request_hash) {
  return_requests_index requests(_marketplace, coopname.value);
  auto idx = requests.get_index<"byhash"_n>();
  auto it = idx.find(request_hash);
  if (it == idx.end()) return std::nullopt;
  return *it;
}

inline return_request get_return_request_by_hash_or_fail(eosio::name coopname,
                                                          const checksum256& request_hash,
                                                          const std::string& msg = "Заявление на возврат не найдено по хэшу") {
  auto r = get_return_request_by_hash(coopname, request_hash);
  eosio::check(r.has_value(), msg);
  return *r;
}

inline void update_return_request(eosio::name coopname, uint64_t request_id,
                                  const std::function<void(return_request&)>& fn) {
  return_requests_index requests(_marketplace, coopname.value);
  auto it = requests.find(request_id);
  eosio::check(it != requests.end(), "Заявление на возврат не найдено по id");
  requests.modify(it, _marketplace, [&](auto& r) { fn(r); });
}

// ── Writeoff proposals ──────────────────────────────────────────────────

inline std::optional<writeoff_proposal> get_writeoff_proposal_by_hash(eosio::name coopname,
                                                                       const checksum256& proposal_hash) {
  writeoff_proposals_index proposals(_marketplace, coopname.value);
  auto idx = proposals.get_index<"byhash"_n>();
  auto it = idx.find(proposal_hash);
  if (it == idx.end()) return std::nullopt;
  return *it;
}

inline writeoff_proposal get_writeoff_proposal_by_hash_or_fail(eosio::name coopname,
                                                                const checksum256& proposal_hash,
                                                                const std::string& msg = "Проект списания не найден по хэшу") {
  auto p = get_writeoff_proposal_by_hash(coopname, proposal_hash);
  eosio::check(p.has_value(), msg);
  return *p;
}

inline void update_writeoff_proposal(eosio::name coopname, uint64_t proposal_id,
                                     const std::function<void(writeoff_proposal&)>& fn) {
  writeoff_proposals_index proposals(_marketplace, coopname.value);
  auto it = proposals.find(proposal_id);
  eosio::check(it != proposals.end(), "Проект списания не найден по id");
  proposals.modify(it, _marketplace, [&](auto& p) { fn(p); });
}

// ── Cross-contract read: ledger2 wallet/userwallet balances ─────────────
//
// Используется в createorder для guard'а Locked Decision L6 (без отрицательного
// баланса) и для решения о пропуске conditional операций o.wal.conv / o.mkt.assign
// (если на целевом кошельке уже хватает available — соответствующий шаг скипается).
//
// ВАЖНО: контракт marketplace не вызывает ledger2::walletop напрямую, а только
// читает state (RAM-таблицы wallets2 / userwallets через cross-contract scope).
// Все мутации идут через `Ledger2::apply` (см. lib/core/ledger2/ledger2.hpp).

struct UserWalletAvailable {
  eosio::asset available = eosio::asset(0, _root_govern_symbol);
  eosio::asset blocked   = eosio::asset(0, _root_govern_symbol);
  bool exists = false;
};

inline UserWalletAvailable get_user_wallet_balance(eosio::name coopname,
                                                    eosio::name wallet_id,
                                                    eosio::name username) {
  // userwallets_index — глобальный typedef в lib/domain/table_ledger2_userwallets.hpp.
  // Для cross-contract read берём scope = coopname.value, code = _ledger2.
  userwallets_index user_wallets(_ledger2, coopname.value);
  auto idx = user_wallets.get_index<"byuserwallet"_n>();
  auto it = idx.find(combine_ids(wallet_id.value, username.value));
  if (it == idx.end()) {
    return UserWalletAvailable{};
  }
  return UserWalletAvailable{ it->available, it->blocked, true };
}

} // namespace Marketplace
