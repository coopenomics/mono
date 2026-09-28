#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"

/**
\defgroup public_gateway Контракт GATEWAY

* Смарт-контракт процессинга банковских и криптовалютных платежей предназначен для обработки входящих и исходящих платежей в кооперативах.
*/

/**
\defgroup public_gateway_processes Процессы
\ingroup public_gateway
*/

/**
\defgroup public_gateway_actions Действия
\ingroup public_gateway
*/

/**
\defgroup public_gateway_tables Таблицы
\ingroup public_gateway
*/

/**
\defgroup public_gateway_consts Константы
\ingroup public_gateway
*/

/**
 * @ingroup public_consts
 * @ingroup public_gateway_consts

 * @brief Константы контракта процессинга платежей
 */
// Константы определены в lib/core/gateway/gateway.hpp:
// gateway_income_actions = {"deposit"_n}
// gateway_outcome_actions = {"withdraw"_n}

/**
 *  \ingroup public_contracts
 *
 *  @brief Класс `gateway` обеспечивает процессинг банковских и криптовалютных платежей в кооперативах.
 *  @details
 */
class [[eosio::contract(GATEWAY)]] gateway : public coop_contract {

public:
  gateway(eosio::name receiver, eosio::name code,
      eosio::datastream<const char *> ds)
      : coop_contract(receiver, code, ds) {}
  
  void apply(uint64_t receiver, uint64_t code, uint64_t action);
  [[eosio::action]] void migrate();
  /// Очистка отработавших записей по правилам контракта (lib/core/cleanup.hpp); плейбук вызывает её на каждом деплое.
  [[eosio::action]] void cleanup();

  //income payments
  [[eosio::action]] void createinpay(eosio::name coopname, eosio::name username, checksum256 income_hash, eosio::asset quantity, eosio::name callback_contract, eosio::name confirm_callback, eosio::name decline_callback);
  [[eosio::action]] void incomplete(eosio::name coopname, checksum256 income_hash);
  [[eosio::action]] void indecline(eosio::name coopname, checksum256 income_hash, std::string reason);
  
  //outcome payments
  [[eosio::action]] void createoutpay(CREATEOUTPAY_SIGNATURE);
  [[eosio::action]] void outcomplete(eosio::name coopname, checksum256 outcome_hash);
  [[eosio::action]] void outdecline(eosio::name coopname, checksum256 outcome_hash, std::string reason);

  // Счётчик идентификаторов (get_global_id) живёт в аккаунте шлюза; без
  // описания в ABI индексер не разбирал его строки и публиковал их пустыми.
  struct [[eosio::table, eosio::contract(GATEWAY)]] counts : counts_base {};
};
