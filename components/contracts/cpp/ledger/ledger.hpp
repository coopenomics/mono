#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"

using namespace eosio;

/**
\defgroup public_ledger Контракт LEDGER

* Смарт-контракт бухгалтерской книги кооператива предназначен для управления счетами согласно стандартам кооперативной отчетности.
*/

/**
\defgroup public_ledger_processes Процессы
\ingroup public_ledger
*/

/**
\defgroup public_ledger_actions Действия
\ingroup public_ledger
*/

/**
\defgroup public_ledger_tables Таблицы
\ingroup public_ledger
*/

/**
\defgroup public_ledger_consts Константы
\ingroup public_ledger
*/

/**
 * @ingroup public_contracts
 * @brief Контракт ledger для управления бухгалтерской книгой кооператива
 * @details Обеспечивает ведение счетов согласно стандартам кооперативной отчетности
 * Счета создаются автоматически при первом пополнении и удаляются при обнулении всех балансов
 */
class [[eosio::contract(LEDGER)]] ledger : public coop_contract {

public:
  ledger(eosio::name receiver, eosio::name code,
      eosio::datastream<const char *> ds)
      : coop_contract(receiver, code, ds) {}
  
  void apply(uint64_t receiver, uint64_t code, uint64_t action);
  [[eosio::action]] void migrate();
  /// Очистка отработавших записей по правилам контракта (lib/core/cleanup.hpp); плейбук вызывает её на каждом деплое.
  [[eosio::action]] void cleanup();

  // Операции со счетами (common процесс)
  [[eosio::action]] void add(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  [[eosio::action]] void sub(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  
  // Операции блокировки/разблокировки средств
  [[eosio::action]] void block(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  [[eosio::action]] void unblock(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  
  // Атомарная операция списания
  [[eosio::action]] void writeoff(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);  
  // Атомарная операция отмены списания
  [[eosio::action]] void writeoffcnsl(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);  
  
  // Операции процесса списания через совет (writeoff процесс)
  [[eosio::action]] void create(eosio::name coopname, eosio::name username, uint64_t account_id, eosio::asset quantity, std::string reason, document2 document, checksum256 writeoff_hash);
  [[eosio::action]] void auth(eosio::name coopname, checksum256 writeoff_hash);
  
  // Коллбэки от gateway
  [[eosio::action]] void complete(eosio::name coopname, checksum256 writeoff_hash);
  [[eosio::action]] void decline(eosio::name coopname, checksum256 writeoff_hash, std::string reason);

}; 