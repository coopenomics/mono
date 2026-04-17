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

Контракт ledger2 реализует единый интерфейс `apply(action_code, ...)` для
всех финансовых движений кооператива. Учёт ведётся на двух уровнях:

  • Уровень кошельков (wallets) + журнал wjournal — атомарные операции
    ISSUE / TRANSFER / BLOCK / UNBLOCK.
  • Уровень счетов (accounts) + журнал journal — парные проводки Dr/Cr,
    сальдо учитывает тип счёта (активный/пассивный/активно-пассивный).

На каждый именованный action_code атомарно совершается ровно одно движение
на уровне кошельков (одна запись в wjournal) и ровно одна парная проводка
на уровне счетов (одна запись в journal). Записи двух журналов перекрёстно
линкованы через journal.wjournal_entry_id ↔ wjournal.journal_entry_id.

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
   * @brief Единая точка входа финансовых движений ledger2.
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void apply(eosio::name coopname,
                                eosio::name initiator,
                                eosio::name action_code,
                                eosio::asset amount,
                                eosio::name username,
                                eosio::checksum256 document_hash,
                                std::string memo);

  /**
   * @brief Одноразовая миграция остатков с ledger.
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void migrate();
};
