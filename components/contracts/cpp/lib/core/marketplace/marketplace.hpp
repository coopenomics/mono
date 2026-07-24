#pragma once

#include <functional>
#include <optional>
#include <string>

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"
#include "../../domain/document_core.hpp"
#include "../../domain/table_ledger2_userwallets.hpp"
#include "../../domain/table_marketplace_fee_config.hpp"
#include "../ledger2/ledger2.hpp"
#include "../branch/branch.hpp"
#include "memo.hpp"
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

// ── Количество как fixed-point asset (Эпик 17, L14) ─────────────────────
//
// quantity/actual_quantity — asset с символом единицы измерения (KG/LTR/PCS);
// дробность веса/объёма выражается младшими единицами (0.500 KG = 500 г).
// Штука (PCS, precision 0) неделима на уровне типа. Цена задаётся за одну
// базовую единицу (кг/литр/штуку) money-asset'ом _root_govern_symbol.

inline bool is_valid_unit_symbol(const eosio::symbol& sym) {
  return sym == _unit_kg || sym == _unit_liter || sym == _unit_piece;
}

/// Валидация количества: корректный asset, известная единица, положительное.
inline void check_quantity(const eosio::asset& quantity) {
  eosio::check(quantity.is_valid() && is_valid_unit_symbol(quantity.symbol),
               "Недопустимая единица измерения количества");
  eosio::check(quantity.amount > 0, "Количество должно быть больше нуля");
}

/// Стоимость = количество × цена-за-базовую-единицу / 10^precision(количества),
/// округление half-up. Цена — money-asset в _root_govern_symbol; результат — в
/// её символе. int128 против переполнения (крупные партии: тонны × цена).
inline eosio::asset calc_cost(const eosio::asset& quantity, const eosio::asset& unit_price) {
  int64_t scale = 1;
  for (uint8_t i = 0; i < quantity.symbol.precision(); ++i) scale *= 10;
  const uint128_t num = static_cast<uint128_t>(quantity.amount) *
                        static_cast<uint128_t>(unit_price.amount);
  const int64_t amount = static_cast<int64_t>((num + static_cast<uint128_t>(scale) / 2) / scale);
  return eosio::asset(amount, unit_price.symbol);
}

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

// Терминал жизненного цикла: запись стирается из RAM, история процесса
// остаётся в журнале действий (blockchain_actions парсера).
inline void erase_order(eosio::name coopname, uint64_t order_id) {
  orders_index orders(_marketplace, coopname.value);
  auto it = orders.find(order_id);
  eosio::check(it != orders.end(), "Заказ не найден по id");
  orders.erase(it);
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

// Терминал жизненного цикла: запись стирается из RAM (история — в журнале
// действий). order.return_request_id НЕ сбрасывается — повторный возврат по
// тому же заказу не открывается.
inline void erase_return_request(eosio::name coopname, uint64_t request_id) {
  return_requests_index requests(_marketplace, coopname.value);
  auto it = requests.find(request_id);
  eosio::check(it != requests.end(), "Заявление на возврат не найдено по id");
  requests.erase(it);
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

// Терминал жизненного цикла: запись стирается из RAM, история процесса —
// в журнале действий (blockchain_actions парсера).
inline void erase_writeoff_proposal(eosio::name coopname, uint64_t proposal_id) {
  writeoff_proposals_index proposals(_marketplace, coopname.value);
  auto it = proposals.find(proposal_id);
  eosio::check(it != proposals.end(), "Проект списания не найден по id");
  proposals.erase(it);
}

// ── Cross-contract read: ledger2 wallet/userwallet balances ─────────────
//
// Используется в createorder для guard'а Locked Decision L6 (без отрицательного
// баланса) — проверка достаточности средств заказчика на паевом кошельке
// перед вызовом o.mkt.lock.
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

// ── Членский взнос «Стола заказов» (requirement b6 «Экономика КУ») ──────

/// Единая ставка членского взноса кооператива (HUNDR_PERCENTS = 100%);
/// 0 — взнос не настроен и не начисляется.
inline uint64_t get_membership_fee_percent(eosio::name coopname) {
  mkt_config_singleton cfg(_marketplace, coopname.value);
  return cfg.exists() ? cfg.get().membership_fee_percent : 0;
}

/// Сумма членского взноса от базы по ставке (целочисленно, вниз).
inline eosio::asset calc_membership_fee(const eosio::asset& base, uint64_t fee_percent) {
  const int64_t amount = static_cast<int64_t>(
      static_cast<uint128_t>(base.amount) * fee_percent / HUNDR_PERCENTS);
  return eosio::asset(amount, _root_govern_symbol);
}

/// Членский взнос заказа (binary_extension: для исторических Order'ов — 0).
inline eosio::asset get_order_membership_fee(const order& o) {
  return o.membership_fee.has_value()
      ? o.membership_fee.value()
      : eosio::asset(0, _root_govern_symbol);
}

/// Полный возврат членского взноса заказа на членский кошелёк «Стола
/// заказов» (o.mkt.refund) при отмене/отклонении/истечении; no-op для
/// заказов без взноса. Частичный возврат при недовыдаче — в signiss2.
inline void refund_membership_fee_if_any(eosio::name coopname, const order& o) {
  const eosio::asset fee = get_order_membership_fee(o);
  if (fee.amount <= 0) return;
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::MEMBERSHIP_FEE_REFUND,
                 fee, o.orderer, o.hash,
                 Marketplace::Memo::get_membership_fee_refund_memo(o.id));
}

/// Полный возврат резерва заказа и членского взноса на членский «Стола
/// заказов» (бесплатная отмена: до акцепта поставщиком либо заказ из остатка
/// кооператива — поставщика и его риска нет).
inline void refund_order_full(eosio::name coopname, const order& o) {
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::UNLOCK_ORDER,
                 o.total_cost, o.orderer, o.hash,
                 Marketplace::Memo::get_cancel_order_memo(o.id));
  refund_membership_fee_if_any(coopname, o);
}

/// Доля удержания при отказе пайщика от получения после акцепта поставщиком.
/// Hard-code (определяется Положением целевой потребительской программы).
inline constexpr uint64_t REFUSAL_PENALTY_PERCENT = 50;

/// Удерживаемая часть суммы (округление вниз — остаток в пользу пайщика).
inline eosio::asset refusal_penalty_share(const eosio::asset& base) {
  return calc_membership_fee(base, REFUSAL_PENALTY_PERCENT);
}

/// Отказ пайщика от получения позиции после акцепта поставщиком: удержание 50%.
/// Тело заказа и членский взнос делятся пополам — удержанная половина уходит
/// в общий кошелёк КУ выдачи (тело — транзитом через пул взносов o.mkt.penalty,
/// затем единым Branch::accrue вместе с удержанной половиной взноса), вторая
/// половина возвращается пайщику на членский «Стола заказов». Имущество
/// остаётся на складе КУ (без движения по счёту 10) — кооператив несёт риск
/// уже оплаченной поставки, под который и держится удержание.
inline void retain_refusal_penalty(eosio::name coopname, const order& o) {
  // ── Тело заказа 50/50 ──
  const eosio::asset penalty_body = refusal_penalty_share(o.total_cost);
  const eosio::asset refund_body  = o.total_cost - penalty_body;

  if (refund_body.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_ORDER,
                   refund_body, o.orderer, o.hash,
                   Marketplace::Memo::get_cancel_order_memo(o.id));
  }
  if (penalty_body.amount > 0) {
    // Транзит: удержанная половина тела → пул членских взносов, откуда уйдёт в КУ.
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::REFUSAL_PENALTY,
                   penalty_body, o.orderer, o.hash,
                   Marketplace::Memo::get_refusal_penalty_transit_memo(o.id));
  }

  // ── Членский взнос 50/50 ──
  const eosio::asset fee         = get_order_membership_fee(o);
  const eosio::asset penalty_fee = refusal_penalty_share(fee);
  const eosio::asset refund_fee  = fee - penalty_fee;
  if (refund_fee.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::MEMBERSHIP_FEE_REFUND,
                   refund_fee, o.orderer, o.hash,
                   Marketplace::Memo::get_membership_fee_refund_memo(o.id));
  }

  // ── Удержанное (тело + взнос) — в общий кошелёк КУ выдачи ──
  // Обе удержанные половины сейчас в пуле членских взносов: тело — транзитом
  // выше, взнос — ещё с createorder; единым accrue зачисляются в w.brn.common.
  const eosio::asset to_common = penalty_body + penalty_fee;
  if (to_common.amount > 0) {
    Branch::accrue(_marketplace, coopname, o.delivery_braname,
                   to_common, o.hash,
                   Marketplace::Memo::get_refusal_penalty_distribute_memo(o.id));
  }
}

} // namespace Marketplace
