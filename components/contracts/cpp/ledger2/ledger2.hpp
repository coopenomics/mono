#pragma once

#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"
#include "../lib/core/ledger2/accounts.hpp"
#include "../lib/core/ledger2/actions.hpp"
#include "../lib/core/ledger2/wallets.hpp"

using namespace eosio;

/**
\defgroup public_ledger2 Контракт LEDGER2
\ingroup public_contracts
\brief Двухконтурный учёт: управленческие кошельки + двойная бухгалтерия.

Контракт ledger2 (пересмотр Epic 1 addendum, 2026-04-18) реализует единый
интерфейс `apply(action_code, ...)` как orchestrator: он рассылает 3
атомарных inline-action, связанных общим `process_hash`:

  1. `walletop` — issue/transfer/block/unblock на wallets2;
  2. `debit`   — +debit_balance на accounts2[Dr] + пересчёт сальдо;
  3. `credit`  — +credit_balance на accounts2[Cr] + пересчёт сальдо.

Каждая inline-action попадает в blockchain_actions отдельной записью с
полями (..., process_hash). Бэкенд собирает «тройку» простым SQL:
`account = 'ledger2' AND data->>'process_hash' = X`.

State-таблицы в RAM:
  • `accounts2` — счёт с account_type, debit_balance, credit_balance, balance;
  • `wallets2`  — кошелёк с available, blocked;
  • `meta`      — служебная (статус миграции).

История в RAM не хранится — она целиком восстанавливается на бэкенде из
blockchain_actions + blockchain_deltas.

Внешних add/sub/writeoff нет — всё движение средств описывается через
ACTION_REGISTRY.
*/

/** \defgroup public_ledger2_actions Действия ledger2 \ingroup public_ledger2 */
/** \defgroup public_ledger2_tables  Таблицы ledger2  \ingroup public_ledger2 */
/** \defgroup public_ledger2_consts  Константы ledger2 \ingroup public_ledger2 */

/**
 * @ingroup public_contracts
 * @brief Контракт ledger2.
 * @details Единственное внешнее финансовое action — apply(). Миграция с
 *          ledger — одноразовое migrate(). Внешних add/sub/writeoff нет:
 *          всё движение средств описывается через ACTION_REGISTRY.
 */
class [[eosio::contract(LEDGER2)]] ledger2 : public eosio::contract {
public:
  ledger2(eosio::name receiver, eosio::name code,
          eosio::datastream<const char*> ds)
      : eosio::contract(receiver, code, ds) {}

  /**
   * @brief Единая точка входа финансовых движений ledger2 (orchestrator).
   *
   * Не пишет в state напрямую: рассылает 3 atomic inline action
   * (`walletop`, `debit`, `credit`), связанных общим `process_hash`.
   *
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void apply(eosio::name coopname,
                                eosio::name initiator,
                                eosio::name action_code,
                                eosio::asset amount,
                                eosio::name username,
                                eosio::checksum256 process_hash,
                                std::string memo);

  /**
   * @brief Атомарная операция по кошельку (issue/transfer/block/unblock).
   *
   * Внутренний action — вызывается только через inline из apply().
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void walletop(eosio::name coopname,
                                   uint8_t op_code,
                                   uint64_t wallet_from,
                                   uint64_t wallet_to,
                                   eosio::asset amount,
                                   eosio::checksum256 process_hash,
                                   std::string memo);

  /**
   * @brief Атомарная дебетовая проводка на счёт + пересчёт сальдо.
   *
   * Внутренний action — вызывается только через inline из apply().
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void debit(eosio::name coopname,
                                uint64_t account_id,
                                eosio::asset amount,
                                eosio::checksum256 process_hash,
                                std::string memo);

  /**
   * @brief Атомарная кредитовая проводка на счёт + пересчёт сальдо.
   *
   * Внутренний action — вызывается только через inline из apply().
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void credit(eosio::name coopname,
                                 uint64_t account_id,
                                 eosio::asset amount,
                                 eosio::checksum256 process_hash,
                                 std::string memo);

  /**
   * @brief Миграция остатков с legacy-ledger в ledger2 (курсорный режим).
   *
   * @param from_coop_index  начальный индекс в таблице registrator::coops (0 — с начала)
   * @param limit            максимум кооп. за один вызов (UINT64_MAX — до конца)
   *
   * Полный прогон: `migrate(0, UINT64_MAX)`. Продовый прогон порциями:
   * `migrate(0, 10)`, `migrate(10, 10)`, ... Мета-таблица хранит
   * `last_migrated_coop_index` для возобновления.
   *
   * Все балансы вносятся через inline `apply(OPENING_*)` — единый путь учёта
   * с полной двойной проводкой и audit-trail в wjournal/journal.
   *
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void migrate(uint64_t from_coop_index, uint64_t limit);
};
