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
#include "../lib/core/ledger2/operations.hpp"
#include "../lib/core/ledger2/wallets.hpp"

using namespace eosio;

/**
\defgroup public_ledger2 Контракт LEDGER2
\ingroup public_contracts
\brief Двухконтурный учёт: управленческие кошельки + двойная бухгалтерия.

Контракт ledger2 (пересмотр Epic 1 addendum, 2026-04-18) реализует единый
интерфейс `apply(operation_code, ...)` как orchestrator: он рассылает 3
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
OPERATION_REGISTRY.
*/

/** \defgroup public_ledger2_actions Действия ledger2 \ingroup public_ledger2 */
/** \defgroup public_ledger2_tables  Таблицы ledger2  \ingroup public_ledger2 */
/** \defgroup public_ledger2_consts  Константы ledger2 \ingroup public_ledger2 */

/**
 * @ingroup public_contracts
 * @brief Контракт ledger2.
 * @details Единственное внешнее финансовое action — apply(). Миграция с
 *          ledger — одноразовое migrate(). Внешних add/sub/writeoff нет:
 *          всё движение средств описывается через OPERATION_REGISTRY.
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
                                eosio::name operation_code,
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
                                   eosio::name wallet_from,
                                   eosio::name wallet_to,
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
   * Все балансы вносятся через inline `apply(operations::migration::*)` — единый путь учёта
   * с полной двойной проводкой и audit-trail (пересмотр 2026-04-20:
   * детерминированное разнесение на 6 целевых кошельков без транзитного
   * счёта 99 и без зеркала CASH_MAIN).
   *
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void migrate(uint64_t from_coop_index, uint64_t limit);

  /**
   * @brief Перевод между кошельками внутри одного бух.счёта (operation o.adj.walmove).
   *
   * Ручная корректировка председателя: переносит `amount` с `from_wallet`
   * на `to_wallet` БЕЗ движения по бух.счетам (`debit`/`credit` не вызываются).
   * Применение: разнесение по аналитическим кошелькам после криво легшей миграции
   * (типичный кейс voskhod), мелкие исправления в рамках одного фонда.
   *
   * Auth: `coopname@active` (председатель). Audit: action+inline walletop попадают
   * в blockchain_actions с общим `process_hash`, бэкенд видит как один процесс
   * `processes::adjustment::CORRECTION` (`p.adj.fix`).
   *
   * Валидация: from_wallet ≠ to_wallet, оба в LEDGER2_WALLET_REGISTRY,
   * memo не пуст. Соответствие `account_id` для двух кошельков обеспечивает
   * UI/backend (контракт не хранит wallet→account mapping).
   *
   * @param coopname     кооператив (одновременно payer auth)
   * @param initiator    инициатор корректировки (для аудита; обычно совпадает с coopname)
   * @param username     владелец кошельков (для аналитики; обычно coopname для коллективных кошельков)
   * @param from_wallet  кошелёк-источник
   * @param to_wallet    кошелёк-получатель
   * @param amount       сумма в _root_govern_symbol
   * @param process_hash уникальный хэш корректировки (генерирует backend)
   * @param memo         обязательное обоснование (≤ 255 символов)
   *
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void walmove(eosio::name coopname,
                                  eosio::name initiator,
                                  eosio::name username,
                                  eosio::name from_wallet,
                                  eosio::name to_wallet,
                                  eosio::asset amount,
                                  eosio::checksum256 process_hash,
                                  std::string memo);

  /**
   * @brief Откат ранее проведённой операции (operation o.adj.rev).
   *
   * Создаёт зеркальную проводку по операции `original_operation_id`:
   * меняет местами Dr/Cr счета и (для wallet_op) wallet_from/wallet_to.
   * Для исходного ISSUE используется новый `WalletOp::REVOKE` (изъятие
   * с `wallet_from` без увеличения куда-либо).
   *
   * Параметры зеркала готовит backend из своей БД (по записи оригинала
   * в blockchain_actions/state) — контракт не имеет доступа к истории операций.
   *
   * Запрещено откатывать миграционные операции (operation_code starts with `o.mig.`).
   * Повторный откат отката (revert от revert) разрешён.
   *
   * Auth: `coopname@active` (председатель).
   *
   * @param coopname                    кооператив (payer auth)
   * @param initiator                   инициатор отката (для аудита)
   * @param original_operation_id       id оригинальной записи в blockchain_actions
   * @param original_operation_code     operation_code оригинала (для запрета o.mig.*)
   * @param username                    username оригинала (для аналитики)
   * @param amount                      сумма (как в оригинале)
   * @param mirror_wallet_op            тип wallet-операции зеркала (REVOKE/TRANSFER/WALLET_ONLY)
   * @param mirror_wallet_from          кошелёк-источник зеркала
   * @param mirror_wallet_to            кошелёк-получатель зеркала (пустое имя для REVOKE)
   * @param mirror_debit_account_id     Dr-счёт зеркала (0 для WALLET_ONLY)
   * @param mirror_credit_account_id    Cr-счёт зеркала (0 для WALLET_ONLY)
   * @param process_hash                уникальный хэш для зеркальной операции
   * @param memo                        обязательное обоснование (≤ 255 символов)
   *
   * @ingroup public_ledger2_actions
   */
  [[eosio::action]] void revert(eosio::name coopname,
                                 eosio::name initiator,
                                 uint64_t original_operation_id,
                                 eosio::name original_operation_code,
                                 eosio::name username,
                                 eosio::asset amount,
                                 uint8_t mirror_wallet_op,
                                 eosio::name mirror_wallet_from,
                                 eosio::name mirror_wallet_to,
                                 uint64_t mirror_debit_account_id,
                                 uint64_t mirror_credit_account_id,
                                 eosio::checksum256 process_hash,
                                 std::string memo);
};
