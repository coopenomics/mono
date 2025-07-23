#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/common.hpp"

using namespace eosio;
using namespace Ledger;

/**
 * @ingroup public_contracts
 * @brief Контракт ledger для управления бухгалтерской книгой кооператива
 * @details Обеспечивает ведение счетов согласно стандартам кооперативной отчетности
 */
class [[eosio::contract(LEDGER)]] ledger : public eosio::contract {

public:
  ledger(eosio::name receiver, eosio::name code,
      eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}
  
  void apply(uint64_t receiver, uint64_t code, uint64_t action);
  [[eosio::action]] void migrate();

  // Инициализация счетов
  [[eosio::action]] void init(eosio::name coopname);

  // Операции со счетами (common процесс)
  [[eosio::action]] void add(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment);
  [[eosio::action]] void sub(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment);
  [[eosio::action]] void transfer(eosio::name coopname, uint64_t from_account_id, uint64_t to_account_id, eosio::asset quantity, std::string comment);
  
  // Операции списания через совет (writeoff процесс)
  [[eosio::action]] void create(eosio::name coopname, eosio::name username, uint64_t account_id, eosio::asset quantity, std::string reason, document2 document, checksum256 writeoff_hash);
  [[eosio::action]] void auth(eosio::name coopname, checksum256 writeoff_hash);
  
  // Коллбэки от gateway
  [[eosio::action]] void complete(eosio::name coopname, checksum256 writeoff_hash);
  [[eosio::action]] void decline(eosio::name coopname, checksum256 writeoff_hash, std::string reason);


}; 