#pragma once

#include <string>

#include <eosio/action.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"
#include "accounts.hpp"
#include "actions.hpp"
#include "wallets.hpp"

/**
 * @brief Хелпер для вызова ledger2::apply из контрактов-инициаторов.
 *
 * Используется вместо прежних Ledger::add / Ledger::sub / Ledger::transfer.
 * Именованные коды операций — в `ledger2_ops::*`. Массив ACTION_REGISTRY
 * определяет маппинг action_code → (process_type, wallet_op, Dr, Cr).
 * На стороне инициатора достаточно передать code, amount, имя пайщика-
 * инициатора, хэш процесса и memo.
 */
class Ledger2 {
public:
  /**
   * @brief Отправить inline action ledger2::apply.
   *
   * @param actor          контракт-инициатор (его permission используется)
   * @param coopname       кооператив (scope в ledger2)
   * @param action_code    именованная операция из ledger2_ops::*
   * @param amount         сумма операции (положительная, символ RUB)
   * @param username       пайщик-инициатор (для истории в operations)
   * @param process_hash   entity-hash процесса (debt_hash/result_hash/...)
   * @param memo           произвольный текстовый комментарий
   */
  static inline void apply(eosio::name actor,
                           eosio::name coopname,
                           eosio::name action_code,
                           eosio::asset amount,
                           eosio::name username,
                           eosio::checksum256 process_hash,
                           std::string memo) {
    eosio::action(
      eosio::permission_level{actor, "active"_n},
      _ledger2,
      "apply"_n,
      std::make_tuple(coopname, actor, action_code, amount, username, process_hash, memo)
    ).send();
  }
};
