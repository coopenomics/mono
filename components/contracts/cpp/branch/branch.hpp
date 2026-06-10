#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"
#include "../lib/core/gateway/gateway.hpp"
#include "../lib/core/ledger2/ledger2.hpp"

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

  // ── Экономика кооперативного участка (requirement b6) ────────────────

  /**
   * @brief Председатель КУ задаёт/меняет вес участника в распределении
   * членских взносов от контракта-источника. Доля = вес / Σ весов.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void setweight(eosio::name coopname, eosio::name braname,
                                    eosio::name contract, eosio::name username,
                                    uint64_t weight);

  /**
   * @brief Исключение участника из распределения (вес удаляется, доли
   * остальных перебалансируются автоматически).
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void delweight(eosio::name coopname, eosio::name braname,
                                    eosio::name contract, eosio::name username);

  /**
   * @brief Зачисление поступивших членских взносов КУ в общий кошелёк
   * участка (o.brn.common, 100% суммы). Вызывается inline
   * контрактом-источником (marketplace) при финализации заказа.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void accrue(eosio::name coopname, eosio::name braname,
                                 eosio::name source_contract,
                                 eosio::asset amount,
                                 eosio::checksum256 process_hash,
                                 std::string memo);

  /**
   * @brief Ручное распределение средств общего кошелька КУ между
   * председателем и доверенными по весам реестра: команда председателя,
   * сумма раскладывается по весам (o.brn.release + o.brn.person), остаток
   * округления остаётся в общем кошельке. Можно частично и многократно.
   * Плановый резерв расходов (30 дней) контролирует бэкенд до вызова.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void distribute(eosio::name coopname, eosio::name braname,
                                     eosio::name source_contract,
                                     eosio::checksum256 round_hash,
                                     eosio::asset amount,
                                     std::string memo);

  /**
   * @brief Перевод персональных средств доверенного в членский кошелёк
   * «Стола заказов» (o.brn.conv) — для заказов как обычный пайщик.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void convert(eosio::name coopname, eosio::name username,
                                  eosio::checksum256 convert_hash,
                                  eosio::asset amount);

  /**
   * @brief Заявка на материальную помощь доверенного из его персонального
   * кошелька: заявление получателя → исходящий платёж через gateway →
   * списание o.brn.aid в callback'е aidconfirm после действия кассира.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void createaid(eosio::name coopname, eosio::name username,
                                    eosio::checksum256 aid_hash,
                                    eosio::asset amount,
                                    document2 statement);

  /**
   * @brief Callback от gateway::outcomplete — кассир подтвердил банковский
   * перевод материальной помощи. Здесь применяется o.brn.aid (Дт 86 / Кт 51).
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void aidconfirm(eosio::name coopname,
                                     eosio::checksum256 outcome_hash);

  /**
   * @brief Callback от gateway::outdecline — перевод не состоялся; средства
   * остаются на персональном кошельке, заявка помечается отклонённой.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void aiddecline(eosio::name coopname,
                                     eosio::checksum256 outcome_hash,
                                     std::string reason);

  /**
   * @brief Команда оплаты расхода КУ из общего кошелька участка: исходящий
   * платёж через gateway → списание o.brn.spend в callback'е spendconfirm
   * после действия кассира. Плановый реестр расходов ведёт бэкенд.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void createspend(eosio::name coopname, eosio::name braname,
                                      eosio::checksum256 spend_hash,
                                      eosio::asset amount,
                                      std::string memo);

  /**
   * @brief Callback от gateway::outcomplete — кассир подтвердил банковский
   * перевод по расходу КУ. Здесь применяется o.brn.spend (Дт 86 / Кт 51).
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void spendconfirm(eosio::name coopname,
                                       eosio::checksum256 outcome_hash);

  /**
   * @brief Callback от gateway::outdecline — перевод не состоялся; средства
   * остаются на общем кошельке КУ, команда помечается отклонённой.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void spenddecline(eosio::name coopname,
                                       eosio::checksum256 outcome_hash,
                                       std::string reason);
};
