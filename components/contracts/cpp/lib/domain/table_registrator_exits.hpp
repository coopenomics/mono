#pragma once

#include <optional>

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"

namespace Registrator {

using namespace eosio;

/**
 * @ingroup public_tables
 * @ingroup public_registrator_tables
 * @par table: exits (registrator)
 *
 * @brief Заявление пайщика на выход из кооператива и сопровождающий его
 * процесс возврата паевого взноса.
 *
 * Жизненный цикл (зеркало вступления reguser→confirmreg и возврата
 * wallet::createwthd→authwthd→completewthd):
 *   - exitcoop    → запись со статусом `pending`, повестка совета `leavecoop`;
 *   - confirmexit → совет одобрил: статус `authorized`, консолидация
 *                   минимального паевого на главный (o.reg.mvmin), резерв
 *                   суммы возврата (o.wal.wthreq) и исходящий платёж в gateway;
 *   - completexit → кассир подтвердил выплату: проводка Дт80/Кт51
 *                   (o.wal.wthcpl), пайщик удаляется, аккаунт блокируется,
 *                   запись стирается;
 *   - declinexit  → отказ совета или отклонение платежа: снятие резерва
 *                   (o.wal.wthdec, если он был сделан) и стирание записи.
 *
 * `quantity` — итоговая сумма возврата, вычисляется контрактом в момент
 * одобрения советом (минимальный + целевой паевой пайщика по L3-балансам
 * ledger2), а не доверяется клиенту.
 */
struct [[eosio::table, eosio::contract(REGISTRATOR)]] exit {
  name username;
  name coopname;
  name status;                  ///< pending | authorized
  time_point_sec created_at;
  document2 statement;          ///< заявление о выходе (registry 200)
  document2 approved_statement; ///< решение совета о выходе (авторизация)
  checksum256 exit_hash;
  asset quantity;               ///< итоговая сумма возврата (заполняется на confirmexit)

  uint64_t primary_key() const { return username.value; }
  checksum256 by_hash() const { return exit_hash; }
};

typedef multi_index<
    "exits"_n, exit,
    indexed_by<"byhash"_n, const_mem_fun<exit, checksum256, &exit::by_hash>>>
    exits_index;

inline std::optional<exit> get_exit_by_hash(name coopname, const checksum256 &hash) {
  exits_index primary_index(_registrator, coopname.value);
  auto secondary_index = primary_index.get_index<"byhash"_n>();

  auto itr = secondary_index.find(hash);
  if (itr == secondary_index.end()) {
    return std::nullopt;
  }

  return *itr;
}

} // namespace Registrator
