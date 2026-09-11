#pragma once

#include <string>

#include <eosio/action.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"
#include "accounts.hpp"
#include "operations.hpp"
#include "wallets.hpp"

/**
 * @brief Хелпер для вызова ledger2::apply из контрактов-инициаторов.
 *
 * Используется вместо прежних Ledger::add / Ledger::sub / Ledger::transfer.
 * Именованные коды операций — в `operations::<contract>::*`, имена процессов —
 * в `processes::<contract>::*` (см. operations.hpp / processes.hpp). Массив
 * `OPERATION_REGISTRY` определяет `operation_code → (wallet_op, Dr, Cr)`.
 *
 * Имя нитки (`process_type`) передаёт инициатор: одна операция может идти в
 * разных процессах, поэтому вывести имя из кода операции нельзя. Пример —
 * членский взнос КУ (`o.brn.common`), который зачисляется внутри нитки
 * поставки, а возвращается внутри нитки гарантийного возврата.
 */
class Ledger2 {
public:
  /**
   * @brief Отправить inline action ledger2::apply.
   *
   * @param actor          контракт-инициатор (его permission используется)
   * @param coopname       кооператив (scope в ledger2)
   * @param operation_code именованная операция из operations::<contract>::*
   * @param process_type   имя нитки процесса из processes::<contract>::*
   * @param amount         сумма операции (положительная, символ RUB)
   * @param username       пайщик-инициатор (для истории в operations)
   * @param process_hash   entity-hash процесса (debt_hash/result_hash/...)
   * @param memo           произвольный текстовый комментарий
   */
  static inline void apply(eosio::name actor,
                           eosio::name coopname,
                           eosio::name operation_code,
                           eosio::name process_type,
                           eosio::asset amount,
                           eosio::name username,
                           eosio::checksum256 process_hash,
                           std::string memo) {
    eosio::action(
      eosio::permission_level{actor, "active"_n},
      _ledger2,
      "apply"_n,
      std::make_tuple(coopname, actor, operation_code, process_type, amount, username, process_hash, memo)
    ).send();
  }

  /**
   * @brief Доступный остаток на USER_SHARED-кошельке по пайщику (или по
   * участку — у w.brn.common разрез по braname). Единственная точка чтения
   * `ledger2::userwallets` для других контрактов: код контракта чужую таблицу
   * напрямую не открывает (задача 99D-16). Нет записи — ноль.
   */
  static inline eosio::asset get_user_available(eosio::name coopname,
                                                eosio::name wallet_name,
                                                eosio::name username) {
    userwallets_index user_wallets(_ledger2, coopname.value);
    auto idx = user_wallets.get_index<"byuserwallet"_n>();
    auto it = idx.find(combine_ids(wallet_name.value, username.value));
    return it == idx.end() ? eosio::asset(0, _root_govern_symbol) : it->available;
  }
};
