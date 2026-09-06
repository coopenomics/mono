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

/// Валидация упаковочного отпуска. `package_size` — содержимое одной упаковки
/// в базовой единице (той же, что и количество). package_size.amount == 0 —
/// отпуск «по мере» (весовой/наливной/поштучный): проверок нет, цена за
/// базовую единицу. package_size.amount > 0 — упаковочный отпуск: символ
/// упаковки равен символу количества, размер положителен, а количество кратно
/// упаковке (заказать/выдать можно только целое число упаковок).
inline void check_packaging(const eosio::asset& quantity, const eosio::asset& package_size) {
  if (package_size.amount == 0) return;  // отпуск по мере
  eosio::check(package_size.is_valid() && package_size.symbol == quantity.symbol,
               "Единица упаковки не совпадает с единицей количества");
  eosio::check(package_size.amount > 0, "Размер упаковки должен быть больше нуля");
  eosio::check(quantity.amount % package_size.amount == 0,
               "Количество должно быть кратно размеру упаковки");
}

/// Стоимость заказа. Два режима отпуска (Эпик 18):
///  - по мере (package_size.amount == 0): `unit_price` — цена за базовую
///    единицу; cost = количество × цена / 10^precision(количества), half-up.
///  - упаковкой (package_size.amount > 0): `unit_price` — цена за упаковку;
///    cost = (количество / размер_упаковки) × цена. Деление точное —
///    кратность гарантирует `check_packaging`, копейка не округляется.
/// Цена — money-asset в _root_govern_symbol; результат — в её символе.
/// int128 против переполнения (крупные партии: тонны × цена).
inline eosio::asset calc_cost(const eosio::asset& quantity, const eosio::asset& unit_price,
                              const eosio::asset& package_size = eosio::asset(0, _unit_piece)) {
  if (package_size.amount > 0) {
    const int64_t packages = quantity.amount / package_size.amount;  // точно (кратность — check_packaging)
    const uint128_t total = static_cast<uint128_t>(packages) *
                            static_cast<uint128_t>(unit_price.amount);
    return eosio::asset(static_cast<int64_t>(total), unit_price.symbol);
  }
  int64_t scale = 1;
  for (uint8_t i = 0; i < quantity.symbol.precision(); ++i) scale *= 10;
  const uint128_t num = static_cast<uint128_t>(quantity.amount) *
                        static_cast<uint128_t>(unit_price.amount);
  const int64_t amount = static_cast<int64_t>((num + static_cast<uint128_t>(scale) / 2) / scale);
  return eosio::asset(amount, unit_price.symbol);
}

/// Доля суммы, пропорциональная части от целого, с округлением половины вверх
/// (то же правило, что в `calc_cost`). Применяется там, где сумму нельзя
/// пересчитать от цены — её надо разделить ровно так, как она сложилась:
/// стоимость возвращаемой части выданного, доля членского взноса и т. п.
/// При part == whole результат равен исходной сумме без потери копейки.
inline eosio::asset pro_rata(const eosio::asset& total, int64_t part, int64_t whole) {
  eosio::check(whole > 0, "Некорректная база для расчёта пропорциональной доли");
  const uint128_t num = static_cast<uint128_t>(total.amount) * static_cast<uint128_t>(part);
  const int64_t amount =
      static_cast<int64_t>((num + static_cast<uint128_t>(whole) / 2) / static_cast<uint128_t>(whole));
  return eosio::asset(amount, total.symbol);
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

/// Заявление на возврат рассматривает кооперативный участок выдачи заказа:
/// имущество вернётся на его склад, а членский взнос списывается с его общего
/// кошелька. Участок приходит параметром действия, поэтому сверяется с заказом
/// на цепи — уполномоченный чужого участка решение по заявлению не проводит.
inline void check_return_request_branch(eosio::name coopname, const return_request& r,
                                        eosio::name braname) {
  auto o = get_order_by_hash_or_fail(coopname, r.original_order_hash);
  eosio::check(o.delivery_braname == braname,
               "Заявление на возврат рассматривает кооперативный участок выдачи заказа");
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

/// Дефолтная ставка членского взноса нового кооператива — 30% (HUNDR_PERCENTS
/// = 100%). Действует, пока председатель явно не настроит свою ставку через
/// `setfee` (в т.ч. явный 0 — взнос осознанно отключён, это по-прежнему
/// доступно, просто больше не подразумевается молчаливым «не настроено»).
constexpr uint64_t DEFAULT_MEMBERSHIP_FEE_PERCENT = 300000;

/// Единая ставка членского взноса кооператива (HUNDR_PERCENTS = 100%);
/// нет явной настройки (singleton не создан) — берётся стандартный дефолт.
inline uint64_t get_membership_fee_percent(eosio::name coopname) {
  mkt_config_singleton cfg(_marketplace, coopname.value);
  return cfg.exists() ? cfg.get().membership_fee_percent : DEFAULT_MEMBERSHIP_FEE_PERCENT;
}

/// Сумма членского взноса от базы по ставке (целочисленно, вниз).
inline eosio::asset calc_membership_fee(const eosio::asset& base, uint64_t fee_percent) {
  const int64_t amount = static_cast<int64_t>(
      static_cast<uint128_t>(base.amount) * fee_percent / HUNDR_PERCENTS);
  return eosio::asset(amount, _root_govern_symbol);
}

/// Членский взнос заказа (ноль — взнос не начислялся).
inline eosio::asset get_order_membership_fee(const order& o) {
  return o.membership_fee;
}

/// Фондирование заказа (паевая модель, уточнение владельца 06.09.2026):
/// внутренний членский кошелёк w.mkt.member расходуется первым — сначала на
/// взнос участка, затем на само тело заказа (членский резерв w.mkt.morder на
/// счёте 86); остальное тело — паевой резерв с паевого кошелька-источника
/// (w.wal.share при createorder, w.mkt.share при stockorder). Недостающую
/// часть пайщик заранее переводит действием convert по заявлению 1110, поэтому
/// здесь членского кошелька обязано хватать на взнос целиком.
struct OrderFunding {
  eosio::asset fee;            ///< взнос участка (весь с членского кошелька)
  eosio::asset body_member;    ///< часть тела из членского кошелька → w.mkt.morder
  eosio::asset body_share;     ///< часть тела с паевого источника → w.mkt.order
};

inline OrderFunding plan_order_funding(eosio::name coopname, eosio::name orderer,
                                       const eosio::asset& total_cost,
                                       const eosio::asset& membership_fee) {
  auto member = get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_MEMBER_FUND, orderer);
  eosio::check(member.available >= membership_fee,
               std::string{"Недостаточно членских средств Стола заказов на членский взнос участка: требуется "} +
                 membership_fee.to_string() + ", доступно " + member.available.to_string() +
                 ". Сначала подайте заявление о переводе паевого взноса в программу.");
  const eosio::asset member_left = member.available - membership_fee;
  const eosio::asset body_member = member_left >= total_cost ? total_cost : member_left;
  return OrderFunding{ membership_fee, body_member, total_cost - body_member };
}

/// Движения фондирования заказа: взнос (o.mkt.fee), членский резерв (o.mkt.lockm)
/// и паевой резерв (share_op с паевого источника). Нулевые суммы пропускаются.
inline void apply_order_funding(eosio::name coopname, uint64_t order_id, eosio::name orderer,
                                const checksum256& order_hash, const OrderFunding& f,
                                eosio::name share_op, const std::string& share_memo) {
  if (f.fee.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::MEMBERSHIP_FEE_LOCK,
                   processes::marketplace::SUPPLY,
                   f.fee, orderer, order_hash,
                   Marketplace::Memo::get_membership_fee_lock_memo(order_id));
  }
  if (f.body_member.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::LOCK_MEMBER_ORDER,
                   processes::marketplace::SUPPLY,
                   f.body_member, orderer, order_hash,
                   Marketplace::Memo::get_member_lock_memo(order_id));
  }
  if (f.body_share.amount > 0) {
    Ledger2::apply(_marketplace, coopname, share_op,
                   processes::marketplace::SUPPLY,
                   f.body_share, orderer, order_hash, share_memo);
  }
}

/// Паевая часть тела заказа (резерв на w.mkt.order).
inline eosio::asset share_funded(const order& o) {
  return o.total_cost - o.member_funded;
}

/// Полный возврат членского взноса заказа на внутренний членский кошелёк
/// (o.mkt.refund) при отмене/отклонении/истечении; no-op для заказов без
/// взноса. Частичный возврат при недовыдаче — в issueact2. Членский остаётся
/// членским: обратно в паевой не транслируется, идёт в зачёт следующего заказа.
inline void refund_membership_fee_if_any(eosio::name coopname, const order& o) {
  const eosio::asset fee = get_order_membership_fee(o);
  if (fee.amount <= 0) return;
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::MEMBERSHIP_FEE_REFUND,
                 processes::marketplace::SUPPLY,
                 fee, o.orderer, o.hash,
                 Marketplace::Memo::get_membership_fee_refund_memo(o.id));
}

/// Возврат резерва по частям: паевая — на свободный паевой «Стола заказов»
/// (o.mkt.unlock), членская — на внутренний членский кошелёк (o.mkt.unlkm).
inline void unlock_order_parts(eosio::name coopname, const order& o,
                               const eosio::asset& share_part, const eosio::asset& member_part,
                               const std::string& share_memo) {
  if (share_part.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_ORDER,
                   processes::marketplace::SUPPLY,
                   share_part, o.orderer, o.hash, share_memo);
  }
  if (member_part.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_MEMBER_ORDER,
                   processes::marketplace::SUPPLY,
                   member_part, o.orderer, o.hash,
                   Marketplace::Memo::get_member_unlock_memo(o.id));
  }
}

/// Полный возврат резерва заказа (паевая часть — на свободный паевой, членская —
/// на членский кошелёк) и сторно членского взноса (бесплатная отмена: до акцепта
/// поставщиком либо заказ из остатка кооператива — поставщика и его риска нет).
inline void refund_order_full(eosio::name coopname, const order& o) {
  unlock_order_parts(coopname, o, share_funded(o), o.member_funded,
                     Marketplace::Memo::get_cancel_order_memo(o.id));
  refund_membership_fee_if_any(coopname, o);
}

/// Доля удержания при отказе пайщика от получения после акцепта поставщиком.
/// Hard-code (определяется Положением целевой потребительской программы).
inline constexpr uint64_t REFUSAL_PENALTY_PERCENT = 50;

/// Срок ожидания решения совета по принятому на участок имуществу при
/// гарантийном возврате. Если совет не решил за это время, оператор вправе
/// выдать имущество заказчику обратно (handback) — баланс не восстанавливается.
/// TBD-Standardization: величину подтверждает методолог.
inline constexpr uint32_t RETURN_DECISION_WAIT_SECS = 7 * 24 * 3600;

/// Снятие документов начатой выдачи с заказа (отказ совета, отмена оператором):
/// заявление, протокол и обе подписи акта очищаются, факт возвращается к заказу.
inline void clear_issue_documents(order& o) {
  o.issue_statement = document2{};
  o.issue_protocol  = document2{};
  o.issue_act1      = document2{};
  o.issue_act2      = document2{};
  o.actual_quantity = o.quantity;
  o.fact_cost       = o.total_cost;
}

/// Удерживаемая часть суммы (округление вниз — остаток в пользу пайщика).
inline eosio::asset refusal_penalty_share(const eosio::asset& base) {
  return calc_membership_fee(base, REFUSAL_PENALTY_PERCENT);
}

/// Отказ пайщика от получения позиции после акцепта поставщиком: удержание 50%.
/// Тело заказа и членский взнос делятся пополам — удержанная половина уходит
/// в общий кошелёк КУ выдачи (тело — транзитом через пул взносов o.mkt.penalty,
/// затем единым Branch::accrue вместе с удержанной половиной взноса), вторая
/// половина возвращается пайщику на свободный паевой «Стола заказов». Имущество
/// остаётся на складе КУ (без движения по счёту 10) — кооператив несёт риск
/// уже оплаченной поставки, под который и держится удержание.
inline void retain_refusal_penalty(eosio::name coopname, const order& o) {
  // ── Тело заказа 50/50, пропорционально паевой и членской частям резерва ──
  const eosio::asset penalty_body = refusal_penalty_share(o.total_cost);
  const eosio::asset penalty_share = o.total_cost.amount > 0
      ? pro_rata(penalty_body, share_funded(o).amount, o.total_cost.amount)
      : eosio::asset(0, _root_govern_symbol);
  const eosio::asset penalty_member = penalty_body - penalty_share;

  unlock_order_parts(coopname, o, share_funded(o) - penalty_share, o.member_funded - penalty_member,
                     Marketplace::Memo::get_cancel_order_memo(o.id));
  if (penalty_share.amount > 0) {
    // Транзит: удержанная часть паевого резерва → пул членских взносов (Дт 80 / Кт 86).
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::REFUSAL_PENALTY,
                   processes::marketplace::SUPPLY,
                   penalty_share, o.orderer, o.hash,
                   Marketplace::Memo::get_refusal_penalty_transit_memo(o.id));
  }
  if (penalty_member.amount > 0) {
    // Удержанная часть членского резерва → пул взносов (внутри 86).
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::REFUSAL_PENALTY_MEMBER,
                   processes::marketplace::SUPPLY,
                   penalty_member, o.orderer, o.hash,
                   Marketplace::Memo::get_refusal_penalty_member_memo(o.id));
  }

  // ── Членский взнос 50/50 ──
  const eosio::asset fee = get_order_membership_fee(o);
  if (fee.amount > 0) {
    const eosio::asset penalty_fee = refusal_penalty_share(fee);
    const eosio::asset refund_fee  = fee - penalty_fee;
    if (refund_fee.amount > 0) {
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::MEMBERSHIP_FEE_REFUND,
                     processes::marketplace::SUPPLY,
                     refund_fee, o.orderer, o.hash,
                     Marketplace::Memo::get_membership_fee_refund_memo(o.id));
    }
    // Удержанная половина взноса остаётся в пуле и уходит участку ниже вместе с телом.
    const eosio::asset to_branch = penalty_body + penalty_fee;
    if (to_branch.amount > 0) {
      Branch::accrue(_marketplace, coopname, o.delivery_braname,
                     to_branch, processes::marketplace::SUPPLY, o.hash,
                     Marketplace::Memo::get_refusal_penalty_distribute_memo(o.id));
    }
  } else if (penalty_body.amount > 0) {
    Branch::accrue(_marketplace, coopname, o.delivery_braname,
                   penalty_body, processes::marketplace::SUPPLY, o.hash,
                   Marketplace::Memo::get_refusal_penalty_distribute_memo(o.id));
  }
}

} // namespace Marketplace
