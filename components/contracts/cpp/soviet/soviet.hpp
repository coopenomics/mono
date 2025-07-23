// #pragma once

#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>
#include <eosio/ignore.hpp>
#include <eosio/transaction.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>

#include "../lib/common.hpp"

/**
 *  \ingroup public_contracts
 *
 *  @brief  Класс `soviet` предоставляет средства для управления и работы кооперативов в рамках блокчейн-системы. 
 *  Он служит связующим звеном между различными контрактами и действиями, предоставляя интерфейс для создания, 
 *  автоматизации, управления и голосования по различным решениям, связанным с деятельностью кооператива.
 *  
 *  Основные функции класса:
 *  - Получение и обработка действий от других контрактов.
 *  - Формирование шаблонов решений для голосования членами совета.
 *  - Выполнение действий на основе принятых решений.
 *  - Управление участниками, их правами и автоматическими действиями в рамках кооператива.
 *  
 *  \note Этот класс является основой для реализации логики кооперативов и их взаимодействия внутри блокчейн-среды.
 */
class [[eosio::contract(SOVIET)]] soviet : public eosio::contract {
public:
  using contract::contract;
  
  [[eosio::action]] void init();
  [[eosio::action]] void migrate();
  
  //agenda.cpp
  [[eosio::action]] void createagenda(CREATEAGENDA_SIGNATURE);
  void authorize_action_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id);
  
  
  //soviet.cpp
  [[eosio::action]] void exec(eosio::name executer, eosio::name coopname, uint64_t decision_id);

  //ниже реестр хранилища документов
  
  
  //документ
  [[eosio::action]] void newsubmitted(NEWSUBMITTED_SIGNATURE);
  [[eosio::action]] void newresolved(NEWRESOLVED_SIGNATURE);
  [[eosio::action]] void newdecision(NEWDECISION_SIGNATURE);
  [[eosio::action]] void newagreement(NEWAGREEMENT_SIGNATURE);
  [[eosio::action]] void newpackage(NEWPACKAGE_SIGNATURE);

  [[eosio::action]] void newact(NEWACT_SIGNATURE);
  [[eosio::action]] void newlink(NEWLINK_SIGNATURE);
  [[eosio::action]] void newdeclined(NEWDECLINED_SIGNATURE);

  [[eosio::action]] void declinedoc(eosio::name coopname, eosio::name username, checksum256 hash, document2 document);

  //approves
  [[eosio::action]] void createapprv(CREATEAPPRV_SIGNATURE);

  [[eosio::action]]
  void confirmapprv(eosio::name coopname, checksum256 approval_hash, document2 approved_document);

  [[eosio::action]]
  void declineapprv(eosio::name coopname, checksum256 approval_hash, std::string reason);


  //registrator.cpp
  [[eosio::action]] void cancelreg(eosio::name coopname, eosio::name username, std::string message);

  //regaccount.cpp
  [[eosio::action]] void addpartcpnt(eosio::name coopname, eosio::name username, eosio::name braname, eosio::name type, eosio::time_point_sec created_at, eosio::asset initial, eosio::asset minimum, bool spread_initial);

  //automator.cpp
  [[eosio::action]] void automate(eosio::name coopname, uint64_t board_id, eosio::name member, eosio::name action_type, eosio::name provider, std::string encrypted_private_key);
  [[eosio::action]] void disautomate(eosio::name coopname, uint64_t board_id, eosio::name member, uint64_t automation_id );
  static void make_base_coagreements(eosio::name coopname, eosio::symbol govern_symbol);
  
  //chairman.cpp
  [[eosio::action]] void authorize(eosio::name coopname, eosio::name chairman, uint64_t decision_id, document2 document);
  [[eosio::action]] void createboard(eosio::name coopname, eosio::name username, eosio::name type, std::vector<board_member> members, std::string name, std::string description);
  [[eosio::action]] void updateboard(eosio::name coopname, eosio::name username, uint64_t board_id, std::vector<board_member> members, std::string name, std::string description);
  
  //admin.cpp
  [[eosio::action]] void addstaff(eosio::name coopname, eosio::name chairman, eosio::name username, std::vector<right> rights, std::string position_title);
  [[eosio::action]] void rmstaff(eosio::name coopname, eosio::name chairman, eosio::name username);
  [[eosio::action]] void setrights(eosio::name coopname, eosio::name chairman, eosio::name username, std::vector<right> rights);
  [[eosio::action]] void validate(eosio::name coopname, eosio::name username, uint64_t decision_id);

  //programs  
  [[eosio::action]] void openprogwall(name coopname, name username, name program_type, uint64_t agreement_id);

  //voting.cpp
  [[eosio::action]] void votefor(
    std::string version,
    eosio::name coopname, 
    eosio::name username, 
    uint64_t decision_id, 
    eosio::time_point_sec signed_at,
    checksum256 signed_hash,
    eosio::signature signature,
    eosio::public_key public_key
  );
  
  [[eosio::action]] void voteagainst(
    std::string version,
    eosio::name coopname, 
    eosio::name username, 
    uint64_t decision_id,
    eosio::time_point_sec signed_at,
    checksum256 signed_hash,
    eosio::signature signature,
    eosio::public_key public_key    
  );
  
  [[eosio::action]] void cancelvote(eosio::name coopname, eosio::name member, uint64_t decision_id);

  //programs.cpp
  [[eosio::action]] void createprog(eosio::name coopname, eosio::name username, eosio::name type, std::string title, std::string announce, std::string description, std::string preview, std::string images, eosio::name calculation_type, eosio::asset fixed_membership_contribution, uint64_t membership_percent_fee, bool is_can_coop_spend_share_contributions, std::string meta);
  [[eosio::action]] void editprog(eosio::name coopname, eosio::name username, uint64_t program_id, uint64_t draft_id, std::string title, std::string announce, std::string description, std::string preview, std::string images, std::string meta);
  [[eosio::action]] void disableprog(eosio::name coopname, uint64_t program_id);
  
  //agreements.cpp
  [[eosio::action]] void sndagreement(eosio::name coopname, eosio::name administrator, eosio::name username, eosio::name agreement_type, document2 document);
  [[eosio::action]] void confirmagree(eosio::name coopname, eosio::name administrator, eosio::name username, uint64_t agreement_id);
  [[eosio::action]] void declineagree(eosio::name coopname, eosio::name administrator, eosio::name username, uint64_t agreement_id, std::string comment);
  [[eosio::action]] void migrateagree(eosio::name coopname, uint64_t agreement_id);
  
  
  //decisions
  [[eosio::action]] void withdraw(eosio::name coopname, eosio::name username, uint64_t withdraw_id, document2 statement);
  [[eosio::action]] void cancelexprd(eosio::name coopname, uint64_t decision_id);

  //contributions.cpp
  // [[eosio::action]] void addbalance(eosio::name coopname, eosio::name username, eosio::asset quantity);
  // [[eosio::action]] void subbalance(eosio::name coopname, eosio::name username, eosio::asset quantity, bool skip_available_check = false);
  // [[eosio::action]] void addprogbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity);
  // [[eosio::action]] void subprogbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity);
  void withdraw_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id, uint64_t batch_id);
  
  [[eosio::action]] void addbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  [[eosio::action]] void subbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, bool skip_available_check, std::string memo);
  [[eosio::action]] void blockbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  [[eosio::action]] void unblockbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  [[eosio::action]] void addmemberfee(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  

  //addresses.cpp
  [[eosio::action]] void creaddress(eosio::name coopname, eosio::name chairman, eosio::name braname, address_data data);
  [[eosio::action]] void deladdress(eosio::name coopname, eosio::name chairman, uint64_t address_id);
  [[eosio::action]] void editaddress(eosio::name coopname, eosio::name chairman, eosio::name braname, uint64_t address_id, address_data data);


  //fund.cpp
  void subaccum_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id, uint64_t program_id);
  [[eosio::action]] void fundwithdraw(eosio::name coopname, eosio::name username, eosio::name type, uint64_t withdraw_id, document2 document);
  
  //participants.cpp
  [[eosio::action]] void block(eosio::name coopname, eosio::name admin, eosio::name username, std::string message);
  [[eosio::action]] void unblock(eosio::name coopname, eosio::name admin, eosio::name username, bool is_registration, std::string message);
    
  //branches.cpp
  [[eosio::action]] void selectbranch(eosio::name coopname, eosio::name username, eosio::name braname, document2 document);
  
  //decisions.cpp
  void freedecision_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id);
  [[eosio::action]] void freedecision(eosio::name coopname, eosio::name username, document2 document, std::string meta);

  //branch.cpp
  [[eosio::action]] void deletebranch(eosio::name coopname, eosio::name braname);
  
  //capital.cpp
  void capital_return_on_withdraw_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id);
  
  [[eosio::action]] void capregcontr(eosio::name coopname, eosio::name username, uint64_t contributor_id, document2 statement, std::string meta);
  void capital_register_contributor_authorize_action_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id);
  void capital_invest_authorize_action_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id);
  [[eosio::action]] void capauthinvst(eosio::name coopname, eosio::name username, uint64_t invest_id, document2 statement, std::string meta);
  
};
  

  struct [[eosio::table, eosio::contract(SOVIET)]] counts : counts_base {};
 
/**
\ingroup public_tables
\brief Таблица автоматизированных действий
*
* Таблица содержит набор действий, которые член совета автоматизировал.
*
* @note Таблица хранится в области памяти с именем аккаунта: @p _soviet и скоупом: @p coopname
*/
struct [[eosio::table, eosio::contract(SOVIET)]] automator {
    uint64_t id; ///< Уникальный идентификатор автоматизированного действия
    eosio::name coopname; ///< Имя кооператива, к которому относится данное автоматизированное действие
    uint64_t board_id; ///< Идентификатор совета, который автоматизировал данное действие
    eosio::name member; ///< Член совета, который автоматизировал данное действие
    eosio::name action_type; ///< Тип автоматизированного действия
    eosio::name permission_name; ///< Имя разрешения для авторизации действия
    std::string encrypted_private_key; ///< Зашифрованный приватный ключ для авторизации действия

    uint64_t primary_key() const { return id; }
    uint128_t by_member_and_action_type() const { return combine_ids(member.value, action_type.value); } ///< Индекс по члену совета и типу действия
    uint64_t by_action() const { return action_type.value; } ///< Индекс по типу действия

};


  typedef eosio::multi_index< "automator"_n, automator,
    eosio::indexed_by<"byaction"_n, eosio::const_mem_fun<automator, uint64_t, &automator::by_action>>,
    eosio::indexed_by<"bymembaction"_n, eosio::const_mem_fun<automator, uint128_t, &automator::by_member_and_action_type>>
  > automator_index;


  struct [[eosio::table, eosio::contract(SOVIET)]] autosigner {
    uint64_t decision_id;
    uint64_t primary_key() const { return decision_id; }    
  };

  typedef eosio::multi_index< "autosigner"_n, autosigner> autosigner_index;


  struct [[eosio::table, eosio::contract(SOVIET)]] joincoops {
    uint64_t id;
    eosio::name username;
    bool is_paid = false; 
    std::string notice;
    
    eosio::binary_extension<eosio::name> braname;
    
    uint64_t primary_key() const {
      return id;
    };

    uint64_t byusername() const {return username.value;}

  };

  typedef eosio::multi_index<"joincoops"_n, joincoops,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<joincoops, uint64_t, &joincoops::byusername>>
  > joincoops_index; 

  struct [[eosio::table, eosio::contract(SOVIET)]] changes {
    uint64_t id;
    uint64_t exchange_id; // идентификатор обмена в контракте marketplace
    uint64_t contribution_product_decision_id;
    uint64_t return_product_decision_id;


    uint64_t primary_key() const {
      return id; 
    };

    uint64_t byexchange() const {
      return exchange_id;
    };
  };

  typedef eosio::multi_index<"changes"_n, changes,
    eosio::indexed_by<"byexchange"_n, eosio::const_mem_fun<changes, uint64_t, &changes::byexchange>>
  > changes_index;



