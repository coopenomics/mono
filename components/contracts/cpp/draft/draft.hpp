#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"

/**
\defgroup public_draft Контракт DRAFT

* Смарт-контракт управления шаблонами документов предназначен для создания, редактирования и управления шаблонами документов и их переводами на различные языки.
*/

/**
\defgroup public_draft_processes Процессы
\ingroup public_draft
*/

/**
\defgroup public_draft_actions Действия
\ingroup public_draft
*/

/**
\defgroup public_draft_tables Таблицы
\ingroup public_draft
*/

/**
\defgroup public_draft_consts Константы
\ingroup public_draft
*/

/**
 * @ingroup public_consts
 * @ingroup public_draft_consts

 * @brief Константы контракта шаблонов документов
 */
// Константы будут добавлены по мере необходимости

class [[eosio::contract(DRAFT)]] draft : public eosio::contract {

public:
  draft(eosio::name receiver, eosio::name code,
        eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  void apply(uint64_t receiver, uint64_t code, uint64_t action);
  
  [[eosio::action]] void migrate();
  
  [[eosio::action]] void newid(eosio::name scope, uint64_t id);

  [[eosio::action]] void createdraft(eosio::name scope, eosio::name username, uint64_t registry_id, eosio::name lang, std::string title, 
      std::string description, std::string context, std::string model, std::string translation_data);

  [[eosio::action]] void editdraft(eosio::name scope, eosio::name username, uint64_t registry_id, std::string title, std::string description, std::string context, std::string model);
    
  [[eosio::action]] void deldraft(eosio::name scope, eosio::name username, uint64_t registry_id);

  [[eosio::action]] void createtrans(eosio::name scope, eosio::name username, uint64_t registry_id, eosio::name lang, std::string data);

  [[eosio::action]] void deltrans(eosio::name scope, eosio::name username, uint64_t translate_id);

  [[eosio::action]] void edittrans(eosio::name scope, eosio::name username, uint64_t translate_id, std::string data);

  [[eosio::action]] void upversion(eosio::name scope, eosio::name username, uint64_t registry_id);

  [[eosio::action]] void approve(eosio::name coopname, eosio::name username, uint64_t registry_id, uint64_t version,
      uint64_t decision_id, eosio::time_point_sec approved_at, eosio::checksum256 text_hash);

  struct [[eosio::table, eosio::contract(DRAFT)]] counts : counts_base {};
  
    
  inline name get_payer_and_check_auth_in_scope(eosio::name scope, eosio::name username, eosio::name action){
    eosio::name payer;
    
    if (scope == _draft) {
      require_auth(_system);
      payer = _system;
    }
    else {
      get_cooperative_or_fail(scope);
      check_auth_or_fail(_draft, scope, username, action);
      payer = username;
    };
    
    return payer;
  }
};
