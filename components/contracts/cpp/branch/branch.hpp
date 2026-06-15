#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"

/**
\defgroup public_branch Контракт BRANCH

* Смарт-контракт управления кооперативными участками предназначен для создания, редактирования и удаления кооперативных участков, а также управления доверенными лицами.
*/

/**
\defgroup public_branch_processes Процессы
\ingroup public_branch
*/

/**
\defgroup public_branch_actions Действия
\ingroup public_branch
*/

/**
\defgroup public_branch_tables Таблицы
\ingroup public_branch
*/

// /**
// \defgroup public_branch_consts Константы
// \ingroup public_branch
// */

/**
 * @ingroup public_consts
 * @ingroup public_branch_consts

 * @brief Константы контракта кооперативных участков
 */
// Константы будут добавлены по мере необходимости

/**
 *  \ingroup public_contracts
 *
 *  @brief  Класс `branch` управляет кооперативными участками.
 */
class [[eosio::contract(BRANCH)]] branch : public eosio::contract
{

public:
  branch(eosio::name receiver, eosio::name code,
              eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  [[eosio::action]] void init();
  [[eosio::action]] void migrate();
  
  [[eosio::action]] void createbranch(eosio::name coopname, eosio::name braname, eosio::name trustee);
  [[eosio::action]] void editbranch(eosio::name coopname, eosio::name braname, eosio::name trustee);
  [[eosio::action]] void deletebranch(eosio::name coopname, eosio::name braname);
  [[eosio::action]] void addtrusted(eosio::name coopname, eosio::name braname, eosio::name trusted);
  [[eosio::action]] void deltrusted(eosio::name coopname, eosio::name braname, eosio::name trusted);

  // Приватность кооперативного участка и управление белым списком (председатель совета).
  // Приватный участок нельзя выбрать (selectbranch), если аккаунт не в белом списке участка.
  [[eosio::action]] void setprivate(eosio::name coopname, eosio::name braname, bool is_private);
  [[eosio::action]] void addwhite(eosio::name coopname, eosio::name braname, eosio::name account);
  [[eosio::action]] void delwhite(eosio::name coopname, eosio::name braname, eosio::name account);

  // Универсальный механизм «собрание → решение» (L1)
  [[eosio::action]] void createdec(eosio::name coopname, eosio::checksum256 hash, eosio::name type, eosio::name initiator, document2 proposal, eosio::name braname, std::vector<decision_point> agenda);
  [[eosio::action]] void joindec(eosio::name coopname, eosio::checksum256 hash, eosio::name username, document2 statement);
  [[eosio::action]] void startdec(eosio::name coopname, eosio::checksum256 hash, eosio::name chairman, std::string address, std::vector<decision_point> agenda);
  [[eosio::action]] void votedec(eosio::name coopname, eosio::checksum256 hash, eosio::name username, document2 ballot, std::vector<decision_vote_point> votes);
  [[eosio::action]] void closedec(eosio::name coopname, eosio::checksum256 hash, document2 protocol);

  // Расширение автоматизируемого решения (L2): создание кооперативного участка через совет.
  // Председатель участка подписывает пакетом заявление, договор о полной материальной
  // ответственности (liability) и доверенность председателю участка (authority).
  [[eosio::action]] void exec(eosio::name coopname, eosio::checksum256 hash, document2 petition, document2 liability, document2 authority);
  [[eosio::action]] void confirmdec(eosio::name coopname, eosio::checksum256 hash, document2 authorization);
  [[eosio::action]] void declinedec(eosio::name coopname, eosio::checksum256 hash, std::string reason);
  [[eosio::action]] void canceldec(eosio::name coopname, eosio::checksum256 hash, std::string reason);

  // Договор о полной материальной ответственности председателя КУ: встречная подпись председателя совета
  // (callback'и одобрения совета; отклонение заблокировано — решение об учреждении участка уже принято)
  [[eosio::action]] void apprliab(eosio::name coopname, eosio::name username, eosio::checksum256 approval_hash, document2 approved_document);
  [[eosio::action]] void declliab(eosio::name coopname, eosio::name username, eosio::checksum256 approval_hash, std::string reason);

  // Доверенность председателя КУ: встречная подпись председателя совета
  // (отдельное одобрение совета рядом с договором матответственности; отклонение заблокировано)
  [[eosio::action]] void apprauth(eosio::name coopname, eosio::name username, eosio::checksum256 approval_hash, document2 approved_document);
  [[eosio::action]] void declauth(eosio::name coopname, eosio::name username, eosio::checksum256 approval_hash, std::string reason);

  // Доверенные лица по заявлению: договор о полной материальной ответственности (application)
  // и доверенность доверенному лицу (authority) — оба со встречной подписью председателя участка
  [[eosio::action]] void reqtrusted(eosio::name coopname, eosio::name braname, eosio::name username, eosio::checksum256 hash, document2 application, document2 authority);
  [[eosio::action]] void apprtrusted(eosio::name coopname, eosio::checksum256 hash, document2 countersigned, document2 countersigned_authority);
  [[eosio::action]] void decltrusted(eosio::name coopname, eosio::checksum256 hash, std::string reason);


};
