#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"

/**
\defgroup public_registrator Контракт REGISTRATOR

* Смарт-контракт регистрации участников кооператива предназначен для регистрации аккаунтов, карточек физических и юридических лиц, а также управления участниками кооперативов.
*/

/**
\defgroup public_registrator_processes Процессы
\ingroup public_registrator
*/

/**
\defgroup public_registrator_actions Действия
\ingroup public_registrator
*/

/**
\defgroup public_registrator_tables Таблицы
\ingroup public_registrator
*/

/**
\defgroup public_registrator_consts Константы
\ingroup public_registrator
*/

/**
 *  \ingroup public_contracts
 *
 *  @brief  Класс `registrator` служит воротами в блокчейн-систему для новых участников, позволяя регистрировать аккаунты,
 *  а также карточки физических и юридических лиц. Через данный контракт участники могут посылать заявления в
 *  совет кооперативов на вступление и получать подтверждения о принятии их заявлений.
 *
 *  Основные функции класса:
 *  - Регистрация новых аккаунтов с различными параметрами (CPU, NET, RAM и т.д.).
 *  - Регистрация карточек физических и юридических лиц.
 *  - Обновление метаданных пользователей.
 *  - Отправка заявлений на вступление в любой кооператив.
 *  - Создание и изменение ключей доступа к аккаунтам.
 *
 *  \note Этот класс служит основой для регистрации и идентификации участников в блокчейн-среде.
 */
class [[eosio::contract(REGISTRATOR)]] registrator : public eosio::contract
{

public:
  registrator(eosio::name receiver, eosio::name code,
              eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  [[eosio::action]] void init();
  [[eosio::action]] void migrate();
  
  [[eosio::action]] void updateaccnt(eosio::name username, eosio::name account_to_change, std::string meta);
  [[eosio::action]] void updatecoop(eosio::name coopname, eosio::name username, eosio::asset initial, eosio::asset minimum, eosio::asset org_initial, eosio::asset org_minimum, std::string announce, std::string description);

  [[eosio::action]] void reguser(eosio::name coopname, eosio::name braname, eosio::name username, eosio::name type, document2 statement, checksum256 registration_hash);

  [[eosio::action]] void regcoop(eosio::name coopname, eosio::name username, org_data params, document2 document);
  [[eosio::action]] void delcoop(eosio::name registrator, eosio::name coopname);  
  [[eosio::action]] void stcoopstatus(eosio::name coopname, eosio::name username, eosio::name status);
  
  [[eosio::action]] void verificate(eosio::name username, eosio::name procedure);

  [[eosio::action]] void newaccount(
      eosio::name coopname, eosio::name referer,
      eosio::name username, eosio::public_key public_key, std::string meta);

  [[eosio::action]] void adduser(
    eosio::name coopname, eosio::name referer,
    eosio::name username, eosio::name type , eosio::time_point_sec created_at,
    eosio::asset initial, eosio::asset minimum, bool spread_initial, std::string meta,
    checksum256 registration_hash);
  
  [[eosio::action]] void changekey(eosio::name coopname, eosio::name changer, eosio::name username, eosio::public_key public_key);
  
  [[eosio::action]] void confirmreg(eosio::name coopname, checksum256 registration_hash, document2 authorization);
  [[eosio::action]] void confirmpay(name coopname, checksum256 registration_hash);
  [[eosio::action]] void declinepay(name coopname, checksum256 registration_hash, std::string reason);
  [[eosio::action]] void declinereg(name coopname, checksum256 registration_hash, std::string reason);
  
  
  [[eosio::action]] void createbranch(eosio::name coopname, eosio::name braname);
  
  [[eosio::action]] void enabranches(eosio::name coopname);
  [[eosio::action]] void disbranches(eosio::name coopname);
  
  // Уменьшение счетчика активных пайщиков при блокировке
  [[eosio::action]] void decparticpnt(eosio::name coopname, eosio::name username);

};
