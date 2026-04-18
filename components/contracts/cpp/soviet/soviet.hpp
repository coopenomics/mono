// #pragma once

#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>
#include <eosio/ignore.hpp>
#include <eosio/transaction.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>

#include "../lib/index.hpp"


/**
\defgroup public_soviet Контракт SOVIET

* Смарт-контракт совета кооператива предназначен для управления процессами принятия решений и подписания документов.
*/

/**
\defgroup public_soviet_processes Процессы
\ingroup public_soviet
*/

/**
\defgroup public_soviet_actions Действия
\ingroup public_soviet
*/

/**
\defgroup public_soviet_tables Таблицы
\ingroup public_soviet
*/

/**
\defgroup public_soviet_consts Константы
\ingroup public_soviet
*/


class [[eosio::contract(SOVIET)]] soviet : public eosio::contract {
public:
  using contract::contract;
  
  [[eosio::action]] void init();
  [[eosio::action]] void migrate();

  /**
   * @brief Восстановление решения в таблице decisions
   * Создает решение с заданными параметрами если его не существует
   * @param coopname Имя кооператива
   * @param decision_id ID решения
   * @param username Имя пользователя
   * @param type Тип решения
   * @param batch_id ID партии
   * @param statement Документ заявления
   * @param votes_for Голоса за
   * @param votes_against Голоса против
   * @param validated Флаг валидации
   * @param approved Флаг одобрения
   * @param authorized Флаг авторизации
   * @param authorized_by Кто авторизовал
   * @param authorization Документ авторизации
   * @param created_at Время создания
   * @param expired_at Время истечения
   * @param meta Мета-данные
   * @param callback_contract Контракт обратного вызова
   * @param confirm_callback Действие подтверждения
   * @param decline_callback Действие отклонения
   * @param hash Хэш решения
   */
  [[eosio::action]] void repairdec(
    eosio::name coopname,
    uint64_t decision_id,
    eosio::name username,
    eosio::name type,
    uint64_t batch_id,
    document2 statement,
    std::vector<eosio::name> votes_for,
    std::vector<eosio::name> votes_against,
    bool validated,
    bool approved,
    bool authorized,
    eosio::name authorized_by,
    document2 authorization,
    eosio::time_point_sec created_at,
    eosio::time_point_sec expired_at,
    std::string meta,
    eosio::name callback_contract,
    eosio::name confirm_callback,
    eosio::name decline_callback,
    checksum256 hash
  );

  /**
   * @brief Конвертирует RUB токены в AXON через инъекцию из фонда eosio.saving
   * Требует подписи _provider. Конвертация происходит по курсу 10:1 (10 RUB = 1 AXON)
   * @param coopname Имя кооператива
   * @param amount Сумма в RUB токенах для конвертации
   */
  [[eosio::action]] void converttoaxn(eosio::name coopname, eosio::asset amount, document2 statement, checksum256 process_hash);

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
  void confirmapprv(eosio::name coopname, eosio::name username, checksum256 approval_hash, std::optional<document2> approved_document);

  [[eosio::action]]
  void declineapprv(eosio::name coopname, eosio::name username, checksum256 approval_hash, std::string reason);


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

  void withdraw_effect(eosio::name executer, eosio::name coopname, uint64_t decision_id, uint64_t batch_id);
  
  [[eosio::action]] void addbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  [[eosio::action]] void subbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, bool skip_available_check, std::string memo);
  [[eosio::action]] void blockbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  [[eosio::action]] void unblockbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  [[eosio::action]] void addmemberfee(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);
  [[eosio::action]] void submemberfee(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo);

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
  
};
  

/**
\ingroup public_tables
\ingroup public_soviet_tables
\brief Таблица счетчиков
*
* Таблица содержит различные счетчики для генерации уникальных идентификаторов.
*
* @note Таблица хранится в области памяти с именем аккаунта: @p _soviet и скоупом: @p coopname

*/
  struct [[eosio::table, eosio::contract(SOVIET)]] counts : counts_base {};
 
/**
\ingroup public_tables
\ingroup public_soviet_tables
\brief Таблица автоматизированных действий
*
* Таблица содержит набор действий, которые член совета автоматизировал.
*
* @note Таблица хранится в области памяти с именем аккаунта: @p _soviet и скоупом: @p coopname
* @par Имя таблицы (table): automator

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


/**
\ingroup public_tables
\ingroup public_soviet_tables
\brief Таблица автоподписанта
*
* Таблица содержит идентификаторы решений для автоматического подписания.
*
* @note Таблица хранится в области памяти с именем аккаунта: @p _soviet и скоупом: @p coopname
* @par Имя таблицы (table): autosigner

*/
  struct [[eosio::table, eosio::contract(SOVIET)]] autosigner {
    uint64_t decision_id; ///< Идентификатор решения для автоподписания
    uint64_t primary_key() const { return decision_id; }    
  };

  typedef eosio::multi_index< "autosigner"_n, autosigner> autosigner_index;


/**
\ingroup public_tables
\ingroup public_soviet_tables
\brief Таблица заявок на вступление в кооператив
*
* Таблица содержит заявки пользователей на вступление в кооператив.
*
* @note Таблица хранится в области памяти с именем аккаунта: @p _soviet и скоупом: @p coopname
* @par Имя таблицы (table): joincoops

*/
  struct [[eosio::table, eosio::contract(SOVIET)]] joincoops {
    uint64_t id; ///< Уникальный идентификатор заявки
    eosio::name username; ///< Имя пользователя, подавшего заявку
    bool is_paid = false; ///< Флаг оплаты вступительного взноса
    std::string notice; ///< Примечание к заявке
    
    eosio::binary_extension<eosio::name> braname; ///< Имя кооперативного участка
    
    uint64_t primary_key() const {
      return id;
    };

    uint64_t byusername() const {return username.value;} ///< Индекс по имени пользователя

  };

  typedef eosio::multi_index<"joincoops"_n, joincoops,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<joincoops, uint64_t, &joincoops::byusername>>
  > joincoops_index; 

/**
\ingroup public_tables
\ingroup public_soviet_tables
\brief Таблица изменений обменов
*
* Таблица содержит информацию об изменениях в обменах маркетплейса.
*
* @note Таблица хранится в области памяти с именем аккаунта: @p _soviet и скоупом: @p coopname
* @par Имя таблицы (table): changes

*/
  struct [[eosio::table, eosio::contract(SOVIET)]] changes {
    uint64_t id; ///< Уникальный идентификатор изменения
    uint64_t exchange_id; ///< Идентификатор обмена в контракте marketplace
    uint64_t contribution_product_decision_id; ///< Идентификатор решения о внесении продукта
    uint64_t return_product_decision_id; ///< Идентификатор решения о возврате продукта


    uint64_t primary_key() const {
      return id; 
    };

    uint64_t byexchange() const {
      return exchange_id; ///< Индекс по идентификатору обмена
    };
  };

  typedef eosio::multi_index<"changes"_n, changes,
    eosio::indexed_by<"byexchange"_n, eosio::const_mem_fun<changes, uint64_t, &changes::byexchange>>
  > changes_index;



