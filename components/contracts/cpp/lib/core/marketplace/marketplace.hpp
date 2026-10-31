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
  orders.modify(it, RamPayer::of(orders, coopname), [&](auto& o) { fn(o); });
}

/// Денежное расширение строки заказа, если в нём действительно сумма.
/// Расширения сериализуются по порядку: когда контракт записывает более
/// позднее поле, все предыдущие ложатся пустым asset без символа ("0 "). Это
/// не сумма, а отсутствие данных — сравнение или вычитание с ним цепь
/// отвергает («comparison of assets with different symbols»), так 11.09.2026
/// на тестнете встали выдача прежних заказов и выплаты поставщикам.
/// value_or(def) у binary_extension не помечен const — читаем через
/// has_value()/value().
inline std::optional<eosio::asset> get_asset_extension(const eosio::binary_extension<eosio::asset>& ext) {
  if (!ext.has_value() || ext.value().symbol.raw() == 0) return std::nullopt;
  return ext.value();
}

/// Принятая стоимость заказа — база долга поставщику (Дт 10 / Кт 76 на
/// приёмке, Дт 76 / Кт 51 на выплате). У заказов, принятых до появления поля,
/// суммы нет: тогда берётся `fact_cost`, как читалось раньше.
inline eosio::asset get_accepted_cost(const order& o) {
  return get_asset_extension(o.accepted_cost).value_or(o.fact_cost);
}

/// Долг поставщика, уже удержанный при инициации выплаты; без суммы — ноль.
inline eosio::asset get_payout_withheld(const order& o) {
  return get_asset_extension(o.payout_withheld).value_or(eosio::asset(0, _root_govern_symbol));
}

/// Выплата поставщику по заказу ещё не завершена: заказ нельзя стирать —
/// обратные вызовы шлюза (`payconfirm` / `paydecline`) и повторная инициация
/// ищут его по хэшу (задача 99D-14).
inline bool is_supplier_settlement_open(const order& o) {
  return o.payout_status != OrderPayoutStatus::COMPLETED;
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

/// Номер новой заявки на возврат. Ноль не выдаётся: в заказе
/// `return_request_id == 0` означает «возврата по заказу не было», а
/// `available_primary_key` на пустой таблице (заявки стираются терминалами)
/// возвращает ноль — тогда по такому заказу открывался бы второй возврат, а
/// `closeorder` не видел бы открытой заявки (задача 99D-16).
inline uint64_t next_return_request_id(eosio::name coopname) {
  return_requests_index requests(_marketplace, coopname.value);
  const uint64_t id = requests.available_primary_key();
  return id == 0 ? 1 : id;
}

/// По заказу есть незакрытая заявка на возврат. Номера стёртых заявок
/// выдаются заново, поэтому заявка с номером из заказа относится к нему,
/// только если совпадает хэш заказа.
inline bool has_open_return_request(eosio::name coopname, const order& o) {
  if (o.return_request_id == 0) return false;
  return_requests_index requests(_marketplace, coopname.value);
  auto it = requests.find(o.return_request_id);
  return it != requests.end() && it->original_order_hash == o.hash;
}

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
  requests.modify(it, RamPayer::of(requests, coopname), [&](auto& r) { fn(r); });
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
  proposals.modify(it, RamPayer::of(proposals, coopname), [&](auto& p) { fn(p); });
}

// Терминал жизненного цикла: запись стирается из RAM, история процесса —
// в журнале действий (blockchain_actions парсера).
inline void erase_writeoff_proposal(eosio::name coopname, uint64_t proposal_id) {
  writeoff_proposals_index proposals(_marketplace, coopname.value);
  auto it = proposals.find(proposal_id);
  eosio::check(it != proposals.end(), "Проект списания не найден по id");
  proposals.erase(it);
}

// ── Warranty claims (претензии поставщику, p.mkt.claim) ─────────────────

inline std::optional<warranty_claim> get_claim_by_hash(eosio::name coopname,
                                                       const checksum256& claim_hash) {
  warranty_claims_index claims(_marketplace, coopname.value);
  auto idx = claims.get_index<"byhash"_n>();
  auto it = idx.find(claim_hash);
  if (it == idx.end()) return std::nullopt;
  return *it;
}

inline warranty_claim get_claim_by_hash_or_fail(eosio::name coopname,
                                                const checksum256& claim_hash,
                                                const std::string& msg = "Гарантийная претензия поставщику не найдена по хэшу") {
  auto c = get_claim_by_hash(coopname, claim_hash);
  eosio::check(c.has_value(), msg);
  return *c;
}

inline void update_claim(eosio::name coopname, uint64_t claim_id,
                         const std::function<void(warranty_claim&)>& fn) {
  warranty_claims_index claims(_marketplace, coopname.value);
  auto it = claims.find(claim_id);
  eosio::check(it != claims.end(), "Гарантийная претензия не найдена по id");
  claims.modify(it, RamPayer::of(claims, coopname), [&](auto& c) { fn(c); });
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

// ── Обеспечительная часть паевого взноса «Стола заказов» (задача 99D-18) ──

/// Дефолтная ставка обеспечительной части нового кооператива — 30%
/// (HUNDR_PERCENTS = 100%). Действует, пока председатель явно не настроит свою
/// ставку через `setfee` (в т.ч. явный 0 — обеспечительная часть осознанно
/// отключена).
constexpr uint64_t DEFAULT_MEMBERSHIP_FEE_PERCENT = 300000;

/// Единая ставка обеспечительной части паевого взноса кооператива
/// (HUNDR_PERCENTS = 100%; имя поля историческое — задача 99D-18);
/// нет явной настройки (singleton не создан) — берётся стандартный дефолт.
inline uint64_t get_membership_fee_percent(eosio::name coopname) {
  mkt_config_singleton cfg(_marketplace, coopname.value);
  return cfg.exists() ? cfg.get().membership_fee_percent : DEFAULT_MEMBERSHIP_FEE_PERCENT;
}

/// Доля суммы по ставке (целочисленно, вниз): обеспечительная часть заказа и
/// удержание при отказе.
inline eosio::asset calc_membership_fee(const eosio::asset& base, uint64_t fee_percent) {
  const int64_t amount = static_cast<int64_t>(
      static_cast<uint128_t>(base.amount) * fee_percent / HUNDR_PERCENTS);
  return eosio::asset(amount, _root_govern_symbol);
}

/// Обеспечительная часть паевого взноса заказа (ноль — не начислялась).
inline eosio::asset get_order_membership_fee(const order& o) {
  return o.membership_fee;
}

/// Достаточность средств заказа (задача 99D-18). Обеспечительная часть паевого
/// взноса берётся только со свободного паевого «Стола заказов» w.mkt.share —
/// недостающее пайщик заранее транслирует на него действием convert по заявлению
/// 1110. Тело — с того, что на w.mkt.share осталось после обеспечительной
/// части, остаток тела — с Цифрового кошелька w.wal.share. Проверка одним
/// чтением, до создания заказа: при нехватке заказ не создаётся.
inline void require_order_funding(eosio::name coopname, eosio::name orderer,
                                  const eosio::asset& body, const eosio::asset& secure_part) {
  auto program = get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, orderer);
  auto wallet  = get_user_wallet_balance(coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
  if (secure_part.amount > 0) {
    eosio::check(program.available >= secure_part,
                 std::string{"MARKETPLACE_SECURE_PART_SHORTFALL: Недостаточно свободного паевого Стола заказов на обеспечительную часть: требуется "} +
                   secure_part.to_string() + ", доступно " + program.available.to_string() +
                   ". Сначала подайте заявление о трансляции паевого взноса в программу.");
  }
  eosio::check(program.available + wallet.available >= body + secure_part,
               std::string{"MARKETPLACE_SHARE_SHORTFALL: Недостаточно паевых средств для заказа: требуется "} +
                 (body + secure_part).to_string() + ", доступно " + (program.available + wallet.available).to_string() +
                 " (свободный паевой Стола заказов " + program.available.to_string() +
                 " и Цифровой кошелёк " + wallet.available.to_string() + ")");
}

/// Паевое тело заказа (и доплата по факту) фондируется двумя паевыми кошельками
/// каждым в свою очередь: сначала свободный паевой «Стола заказов» w.mkt.share
/// (туда возвращаются паевые средства при отменах, недовыдачах и гарантийных
/// возвратах), остаток — с главного паевого Цифрового кошелька w.wal.share.
/// Обе части ложатся одним паевым резервом w.mkt.order (o.mkt.lockp и
/// o.mkt.lock, без проводок — все кошельки на 80). При нехватке — отказ.
inline void lock_order_body(eosio::name coopname, uint64_t order_id, eosio::name orderer,
                            const checksum256& order_hash, const eosio::asset& body,
                            const std::string& program_memo, const std::string& wallet_memo) {
  if (body.amount <= 0) return;
  auto program = get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, orderer);
  const eosio::asset from_program = program.available >= body ? body : program.available;
  const eosio::asset from_wallet  = body - from_program;
  if (from_wallet.amount > 0) {
    auto wallet = get_user_wallet_balance(coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
    eosio::check(wallet.available >= from_wallet,
                 std::string{"Недостаточно паевых средств для заказа: требуется с Цифрового кошелька "} +
                   from_wallet.to_string() + ", доступно " + wallet.available.to_string() +
                   " (свободный паевой Стола заказов " + program.available.to_string() + " уже учтён)");
  }
  if (from_program.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::LOCK_FROM_SHARE,
                   processes::marketplace::SUPPLY,
                   from_program, orderer, order_hash, program_memo);
  }
  if (from_wallet.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::LOCK_ORDER,
                   processes::marketplace::SUPPLY,
                   from_wallet, orderer, order_hash, wallet_memo);
  }
}

/// Обеспечительная часть паевого взноса под заказ со свободного паевого «Стола
/// заказов» (o.mkt.fee, w.mkt.share → w.mkt.fee); no-op для нулевой суммы.
/// Идёт раньше тела заказа: тело берёт со свободного паевого то, что осталось.
inline void lock_secure_part(eosio::name coopname, eosio::name orderer,
                             const checksum256& order_hash,
                             const eosio::asset& amount, const std::string& memo) {
  if (amount.amount <= 0) return;
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::SECURE_PART_LOCK,
                 processes::marketplace::SUPPLY,
                 amount, orderer, order_hash, memo);
}

/// Возврат обеспечительной части на свободный паевой «Стола заказов»
/// (o.mkt.refund, w.mkt.fee → w.mkt.share); no-op для нулевой суммы.
inline void refund_secure_part(eosio::name coopname, const order& o, const eosio::asset& amount) {
  if (amount.amount <= 0) return;
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::SECURE_PART_REFUND,
                 processes::marketplace::SUPPLY,
                 amount, o.orderer, o.hash,
                 Marketplace::Memo::get_secure_part_refund_memo(o.id));
}

/// Обеспечительная часть к списанию (o.mkt.todue, w.mkt.fee → w.mkt.due);
/// no-op для нулевой суммы. Когда списывать, решает бэкенд (chargedue).
inline void move_secure_part_to_due(eosio::name coopname, const order& o, const eosio::asset& amount) {
  if (amount.amount <= 0) return;
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::SECURE_TO_DUE,
                 processes::marketplace::SUPPLY,
                 amount, o.orderer, o.hash,
                 Marketplace::Memo::get_secure_to_due_memo(o.id));
}

/// Полный возврат обеспечительной части заказа при отмене, отклонении,
/// истечении; no-op для заказов без неё. Частичный — в issueact2.
inline void refund_secure_part_if_any(eosio::name coopname, const order& o) {
  refund_secure_part(coopname, o, get_order_membership_fee(o));
}

/// Полный возврат резерва заказа и обеспечительной части на свободный паевой
/// «Стола заказов» (бесплатная отмена: до акцепта поставщиком либо заказ из остатка
/// кооператива — поставщика и его риска нет).
inline void refund_order_full(eosio::name coopname, const order& o) {
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::UNLOCK_ORDER,
                 processes::marketplace::SUPPLY,
                 o.total_cost, o.orderer, o.hash,
                 Marketplace::Memo::get_cancel_order_memo(o.id));
  refund_secure_part_if_any(coopname, o);
}

/// Доля удержания при отказе пайщика от получения после акцепта поставщиком.
/// Hard-code (определяется Положением целевой потребительской программы).
inline constexpr uint64_t REFUSAL_PENALTY_PERCENT = 50;

/// Снятие документов начатой выдачи с заказа (отказ совета, отмена оператором):
/// заявление, протокол и обе подписи акта очищаются, факт возвращается к заказу.
inline void clear_issue_documents(order& o) {
  o.issue_statement.emplace(document2{});
  o.issue_protocol.emplace(document2{});
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
/// Тело заказа и обеспечительная часть делятся пополам. Удержанные половины
/// остаются паевыми и ложатся на кошелёк пайщика к списанию w.mkt.due (тело —
/// o.mkt.penal с резерва, обеспечительная часть — o.mkt.todue из пула); членским
/// взносом участка они становятся при списании по условиям ЦПП первого числа
/// месяца (chargedue, решение владельца 31.10.2026, задача 99D-18). Вторые
/// половины возвращаются на свободный паевой «Стола заказов». Имущество
/// остаётся на складе участка (без движения по счёту 10). Долг поставщику
/// (Кт 76 с приёмки) удержание не трогает: он гасится выплатой своим чередом.
inline void retain_refusal_penalty(eosio::name coopname, const order& o) {
  // ── Тело заказа 50/50 ──
  const eosio::asset penalty_body = refusal_penalty_share(o.total_cost);
  const eosio::asset refund_body  = o.total_cost - penalty_body;

  if (refund_body.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_ORDER,
                   processes::marketplace::SUPPLY,
                   refund_body, o.orderer, o.hash,
                   Marketplace::Memo::get_cancel_order_memo(o.id));
  }
  if (penalty_body.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::REFUSAL_PENALTY,
                   processes::marketplace::SUPPLY,
                   penalty_body, o.orderer, o.hash,
                   Marketplace::Memo::get_refusal_penalty_memo(o.id));
  }

  // ── Обеспечительная часть 50/50 ──
  const eosio::asset fee         = get_order_membership_fee(o);
  const eosio::asset penalty_fee = refusal_penalty_share(fee);
  refund_secure_part(coopname, o, fee - penalty_fee);
  move_secure_part_to_due(coopname, o, penalty_fee);
}

// ── Факты Стола заказов для других контрактов (shared-слой, задача 99D-16) ──
// Код других контрактов таблиц marketplace напрямую не читает: участок,
// выход пайщика и прочие проверки спрашивают Стол заказов только этими методами.

/// Участок занят Столом заказов: он участок выдачи или приёмки хотя бы одного
/// заказа (пока по заказу открыта заявка на возврат, заказ тоже жив).
inline bool has_orders_at_branch(eosio::name coopname, eosio::name braname) {
  orders_index orders(_marketplace, coopname.value);
  auto by_delivery = orders.get_index<"bydelivbra"_n>();
  if (by_delivery.find(braname.value) != by_delivery.end()) return true;
  auto by_accept = orders.get_index<"byacceptbra"_n>();
  return by_accept.find(braname.value) != by_accept.end();
}

/// Выход пайщика не оставит в Столе заказов незавершённого: решение совета по
/// открытой заявке на возврат зачислило бы паевой и взнос на заблокированный
/// аккаунт (задача 99D-16). Резерв под заказы держит выход сам по себе —
/// строкой BLOCKER в таблице EXIT_WALLET_POLICY (задача 99D-15).
inline void check_member_can_exit(eosio::name coopname, eosio::name username) {
  return_requests_index requests(_marketplace, coopname.value);
  auto by_orderer = requests.get_index<"byorderer"_n>();
  eosio::check(by_orderer.find(username.value) == by_orderer.end(),
               "Выход из кооператива невозможен: открыто заявление на гарантийный возврат в Столе заказов — дождитесь его рассмотрения");
}

/// Выход состоялся: остаток обеспечительной части к списанию w.mkt.due по
/// условиям ЦПП списывается в членский взнос немедленно (решение владельца
/// 31.10.2026, задача 99D-18): транзитом через пул (o.mkt.exfee) и далее в
/// общий кошелёк участка, к которому прикреплён пайщик (o.brn.common,
/// Дт 80 / Кт 86). Пайщик без участка или участок удалён — остаток остаётся в
/// пуле. `actor` — контракт, проводящий выход (его разрешение подписывает операции).
inline void settle_due_on_exit(eosio::name actor, eosio::name coopname,
                               eosio::name username, const checksum256& exit_hash) {
  const eosio::asset balance =
      get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_SECURE_DUE, username).available;
  if (balance.amount <= 0) return;

  Ledger2::apply(actor, coopname, operations::marketplace::EXIT_DUE_TO_POOL,
                 processes::wallet::WITHDRAW, balance, username, exit_hash,
                 "Обеспечительная часть Стола заказов к списанию при выходе, username=" +
                   username.to_string());

  const auto braname = ::get_participant_branch(coopname, username);
  if (!braname.has_value() || !Branch::exists(coopname, *braname)) return;
  Branch::accrue(actor, coopname, *braname, balance, processes::wallet::WITHDRAW, exit_hash,
                 "Обеспечительная часть Стола заказов списана в членский взнос участка при выходе, username=" +
                   username.to_string());
}

} // namespace Marketplace
