#pragma once

#include <string>

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"
#include "../../domain/table_ledger2_userwallets.hpp"
#include "../../domain/table_edubridge_subscriptions.hpp"
#include "../../domain/table_edubridge_rids.hpp"
#include "../ledger2/ledger2.hpp"
#include "../utils.hpp"

/**
 * @file edubridge.hpp
 * @brief Helpers контракта edubridge (ЦПП «Образование», приложение
 * «Образовательный мост»): доступ к анкер-таблицам процессов p.edu.access /
 * p.edu.rid, чтение доступного баланса пайщика и человекочитаемые memo
 * ledger2-операций.
 *
 * Контракт edubridge не вызывает ledger2::walletop напрямую, а только читает
 * state (RAM-таблица userwallets через cross-contract scope). Все мутации идут
 * через `Ledger2::apply` (см. lib/core/ledger2/ledger2.hpp).
 */
namespace Edubridge {

using namespace eosio;

// ── Доступный баланс пайщика по кошельку ledger2 ─────────────────────────
//
// Аналог `Marketplace::get_user_wallet_balance` — вынесен отдельно, чтобы не
// тянуть в edubridge заголовки «Стола заказов».

struct UserWalletAvailable {
  eosio::asset available = eosio::asset(0, _root_govern_symbol);
  eosio::asset blocked   = eosio::asset(0, _root_govern_symbol);
  bool exists = false;
};

inline UserWalletAvailable get_user_wallet_balance(eosio::name coopname,
                                                    eosio::name wallet_id,
                                                    eosio::name username) {
  userwallets_index user_wallets(_ledger2, coopname.value);
  auto idx = user_wallets.get_index<"byuserwallet"_n>();
  auto it = idx.find(combine_ids(wallet_id.value, username.value));
  if (it == idx.end()) {
    return UserWalletAvailable{};
  }
  return UserWalletAvailable{ it->available, it->blocked, true };
}

// ── Поиск анкеров процессов ──────────────────────────────────────────────

/// Подписка по sub_hash; бросает, если не найдена.
inline edu_subscriptions_index::const_iterator
get_subscription_or_fail(edu_subscriptions_index& subs, const checksum256& sub_hash) {
  auto idx = subs.get_index<"byhash"_n>();
  auto it = idx.find(sub_hash);
  eosio::check(it != idx.end(), "Подписка с указанным hash не найдена");
  return subs.find(it->id);
}

/// Заявление о РИД по rid_hash; бросает, если не найдено.
inline edu_rids_index::const_iterator
get_rid_or_fail(edu_rids_index& rids, const checksum256& rid_hash) {
  auto idx = rids.get_index<"byhash"_n>();
  auto it = idx.find(rid_hash);
  eosio::check(it != idx.end(), "Заявление о паевом взносе РИД с указанным hash не найдено");
  return rids.find(it->id);
}

/// Валидация денежной суммы контракта: корректный asset, > 0, символ кооператива.
inline void check_money(const eosio::asset& amount, const char* what) {
  eosio::check(amount.is_valid() && amount.amount > 0,
               std::string{what} + " должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               std::string{"Некорректный символ валюты: "} + what);
}

/**
 * @brief Человекочитаемые memo ledger2-операций ЦПП «Образование».
 *
 * Текст попадает в выписку пайщика и отчёт бухгалтеру — пользовательский
 * слой, без технических токенов (имён процессов, кодов операций).
 */
namespace Memo {

  inline std::string get_convert_to_member_memo() {
    return "Конвертация паевого взноса в членский взнос по ЦПП «Образование» по заявлению пайщика";
  }

  inline std::string get_accept_rid_memo(uint64_t rid_id) {
    return "Приём результата интеллектуальной деятельности преподавателя в паевой фонд по заявлению № " +
           std::to_string(rid_id) + " и решению совета";
  }

} // namespace Memo

} // namespace Edubridge
