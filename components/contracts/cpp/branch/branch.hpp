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
#include "../expense/expense.hpp"   // ExpenseDomain::item / callback_handler — для inline-action в шасси расходов

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
  [[eosio::action]] void joindec(eosio::name coopname, eosio::checksum256 hash, eosio::name username);
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
   * @brief Возврат членских взносов КУ из общего кошелька участка обратно в
   * пул взносов программы-источника (o.brn.retfee) — инверсия accrue.
   * Вызывается inline контрактом-источником (marketplace) при гарантийном
   * возврате имущества, чтобы пайщику вернулась полная уплаченная сумма.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void retfee(eosio::name coopname, eosio::name braname,
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
   * @brief Заявление на материальную помощь доверенного из его персонального
   * кошелька: подписанное заявление вносится на повестку совета (type=brnaid).
   * Исходящий платёж кассиру создаётся только после решения совета — в
   * callback'е onaidauth.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void createaid(eosio::name coopname, eosio::name username,
                                    eosio::name braname,
                                    eosio::checksum256 aid_hash,
                                    eosio::asset amount,
                                    document2 statement,
                                    std::string meta);

  /**
   * @brief Callback от soviet — совет одобрил выплату материальной помощи.
   * Заявление переходит в authorized, протокол сохраняется, и регистрируется
   * исходящий платёж в gateway — заявка попадает к кассиру.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void onaidauth(eosio::name coopname,
                                    eosio::checksum256 hash,
                                    document2 authorization);

  /**
   * @brief Callback от soviet — совет отказал в выплате либо срок рассмотрения
   * истёк. Заявление закрывается, не доходя до кассира; средства остаются на
   * персональном кошельке.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void onaiddecl(eosio::name coopname,
                                    eosio::checksum256 hash,
                                    std::string reason);

  /**
   * @brief Callback от gateway::outcomplete — кассир подтвердил банковский
   * перевод материальной помощи. Здесь применяется o.brn.aid (Дт 86 / Кт 51).
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void aidconfirm(eosio::name coopname,
                                     eosio::checksum256 outcome_hash);

  /**
   * @brief Callback от gateway::outdecline — перевод не состоялся; средства
   * остаются на персональном кошельке, заявление закрывается.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void aiddecline(eosio::name coopname,
                                     eosio::checksum256 outcome_hash,
                                     std::string reason);

  /**
   * @brief Подать расход участка в шасси расходов: средства уходят из общего
   * кошелька КУ в пул расходов (o.brn.expfnd), записка передаётся шасси —
   * решение совета, оплата по реквизитам либо аванс под отчёт, отчёт,
   * закрытие.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void createexp(eosio::name coopname, eosio::name braname,
                                    eosio::name creator,
                                    eosio::checksum256 expense_hash,
                                    std::vector<ExpenseDomain::item> items,
                                    document2 statement);

  /**
   * @brief Callback шасси расходов — расход завершён (отклонён советом либо
   * закрыт). Неизрасходованный остаток возвращается в общий кошелёк участка
   * (o.brn.expunf), запись расхода стирается.
   * @ingroup public_branch_actions
   */
  [[eosio::action]] void onexpdone(eosio::name coopname,
                                    eosio::checksum256 expense_hash,
                                    uint8_t status,
                                    eosio::asset total_actual,
                                    std::vector<char> data);
};
