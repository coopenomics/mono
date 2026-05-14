#pragma once
#include <cstdint>

/**
\defgroup public_capital Контракт CAPITAL

*/

/**
\defgroup public_capital_processes Процессы
\ingroup public_capital
*/

/**
\defgroup public_capital_actions Действия
\ingroup public_capital
*/ 

/** 
\defgroup public_capital_tables Таблицы
\ingroup public_capital
*/

/**
\defgroup public_capital_consts Константы
\ingroup public_capital
*/

/**
 * Коэффициенты бизнес-логики (не управляются конфигом)
 * @ingroup public_consts
 * @ingroup public_capital_consts
 * 
 * @{
 */
const double CREATORS_BONUS_COEFFICIENT = 1; ///< Коэффициент премий создателей от своей себестоимости (100%)
const double AUTHOR_BASE_COEFFICIENT = 0.618; ///< Коэффициент авторской себестоимости от себестоимости создателя (61.8%)
const double AUTHOR_BONUS_COEFFICIENT = 1;    ///< Коэффициент премий авторов от своей себестоимости (100%)
const double CONTRIBUTORS_BONUS_COEFFICIENT = 0.618; ///< Коэффициент премий участников от себестоимостей создателей, авторов и координаторов (161.8%)
const uint32_t MAX_PROJECT_AUTHORS = 12; ///< Максимальное количество авторов в проекте
const uint64_t MAX_RATE_PER_HOUR = 30000000; ///< Максимальная ставка за час
const uint64_t MAX_HOURS_PER_DAY = 12; ///< Максимальное количество часов в день
constexpr uint128_t CRPS_PRECISION_FACTOR = 100000000000000ULL; ///< Масштаб для CRPS (10^14)

/** @} */

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include "../lib/index.hpp"
#include "domain/index.hpp"


using namespace eosio;
using std::string;

/**
 *  \ingroup public_contracts
 *  @brief  Контракт Capital управляет вкладами, распределением вознаграждений и выводом средств для участников.
 *  Capital — это контракт, управляющий вкладами участников, распределением вознаграждений и механизмами вывода средств в системе. Он поддерживает два типа вкладов — интеллектуальные и имущественные, и предоставляет два метода для участников, чтобы вывести свои средства при различных условиях.
 */
class [[eosio::contract]] capital : public contract {
public:
    using contract::contract;
    
    /**
     * @brief Устанавливает или обновляет конфигурацию контракта для кооператива.
     * \ingroup public_actions
     */
    [[eosio::action]]
    void setconfig(name coopname, Capital::config config);

    [[eosio::action]]
    void migrate();

    // Создать проект
    [[eosio::action]]
    void createproj (
      eosio::name coopname,
      checksum256 project_hash,
      checksum256 parent_hash,
      std::string title,
      std::string description,
      std::string invite,
      std::string meta,
      std::string data
    );
    
    // Редактировать проект
    [[eosio::action]]
    void editproj (
      eosio::name coopname,
      checksum256 project_hash,
      std::string title,
      std::string description,
      std::string invite,
      std::string meta,
      std::string data
    );
    
    
    // Открыть проект на приём инвестиций
    [[eosio::action]]
    void openproject(name coopname, checksum256 project_hash);

    // Закрыть проект от приёма инвестиций
    [[eosio::action]]
    void closeproject(name coopname, checksum256 project_hash);

    // Запустить проект на приём коммитов
    [[eosio::action]]
    void startproject(name coopname, checksum256 project_hash);

    // Остановить проект
    [[eosio::action]]
    void stopproject(name coopname, checksum256 project_hash);

    // Финализировать проект (после всех конвертаций)
    [[eosio::action]]
    void finalizeproj(name coopname, checksum256 project_hash);

    // Возврат неиспользованных инвестиций в глобальный пул (трекинговое действие)
    [[eosio::action]]
    void returntopool(name coopname, checksum256 project_hash, asset amount);

    // Завершить проект и начать голосование
    [[eosio::action]]
    void startvoting(name coopname, checksum256 project_hash);
    
    // Завершить голосование
    [[eosio::action]]
    void cmpltvoting(name coopname, checksum256 project_hash);

    // Подсчитать результаты голосования для участника
    [[eosio::action]]
    void calcvotes(name coopname, name username, checksum256 project_hash);
    
    // Проголосовать по методу Водянова
    [[eosio::action]]
    void submitvote(name coopname, name voter, checksum256 project_hash, std::vector<Capital::vote_input> votes);
    
    // Удалить проект
    [[eosio::action]]
    void delproject(name coopname, checksum256 project_hash);
    
    // Конвертация сегмента
    [[eosio::action]]
    void convertsegm(eosio::name coopname, eosio::name username, checksum256 project_hash, checksum256 result_hash, asset wallet_amount, asset capital_amount, document2 convert_statement);

    // Очистка сегмента чистого инвестора
    [[eosio::action]]
    void purgesegment(eosio::name coopname, eosio::name username, checksum256 project_hash);

    // results
    [[eosio::action]]
    void pushrslt(name coopname, name username, checksum256 project_hash, checksum256 result_hash, 
                  eosio::asset contribution_amount, eosio::asset debt_amount, document2 statement, std::vector<checksum256> debt_hashes);
    
    [[eosio::action]]
    void authrslt(eosio::name coopname, checksum256 result_hash, document2 decision);
    
    [[eosio::action]]
    void approverslt(eosio::name coopname, eosio::name username, checksum256 result_hash, document2 approved_statement);
    
    [[eosio::action]]
    void declrslt(eosio::name coopname, checksum256 result_hash, std::string reason);
    
    [[eosio::action]]
    void signact1(eosio::name coopname, eosio::name username, checksum256 result_hash, document2 act);
    
    [[eosio::action]]
    void signact2(eosio::name coopname, eosio::name chairman, checksum256 result_hash, document2 act);
    
    // конвертация
    
    [[eosio::action]]
    void addauthor(name coopname, checksum256 project_hash, name author);
    
    // Коммиты
    [[eosio::action]]
    void createcmmt(eosio::name coopname, eosio::name username, checksum256 project_hash, checksum256 commit_hash, uint64_t creator_hours, std::string description, std::string meta);
    [[eosio::action]]
    void approvecmmt(eosio::name coopname, eosio::name master, checksum256 commit_hash);
    [[eosio::action]]
    void declinecmmt(eosio::name coopname, eosio::name master, checksum256 commit_hash, std::string reason);
    
    // Регистрация
    [[eosio::action]]
    void regcontrib(eosio::name coopname, eosio::name username, checksum256 contributor_hash, eosio::asset rate_per_hour, uint64_t hours_per_day, bool is_external_contract, document2 storage_agreement, std::optional<document2> contract, std::optional<document2> blagorost_agreement, std::optional<document2> generator_agreement);
    [[eosio::action]]
    void approvereg(eosio::name coopname, eosio::name username, checksum256 contributor_hash, document2 contract);
    [[eosio::action]]
    void declinereg(eosio::name coopname, eosio::name username, checksum256 contributor_hash, std::string reason);

    // Редактирование участников
    [[eosio::action]]
    void editcontrib(eosio::name coopname, eosio::name username, eosio::asset rate_per_hour, uint64_t hours_per_day);

    // Обновление энергии участника (геймификация)
    [[eosio::action]]
    void refreshcontr(eosio::name coopname, eosio::name username);
    
    // Уведомление о переходе на новый уровень (геймификация)
    [[eosio::action]]
    void lvlnotify(eosio::name coopname, eosio::name username, uint32_t prev_level, uint32_t new_level);

    // Импорт участников
    [[eosio::action]]
    void importcontrib(eosio::name coopname, eosio::name username, checksum256 contributor_hash, eosio::asset contribution_amount, std::string memo);

    // Приложения к договору УХД
    [[eosio::action]]
    void getclearance(eosio::name coopname, eosio::name username, checksum256 project_hash, checksum256 appendix_hash, document2 document);
    [[eosio::action]]
    void apprvappndx(eosio::name coopname, eosio::name username, checksum256 appendix_hash, document2 approved_document);
    [[eosio::action]]
    void dclineappndx(eosio::name coopname, eosio::name username, checksum256 appendix_hash, std::string reason);
    
    
    // Планирование
    [[eosio::action]] void setmaster(name coopname, checksum256 project_hash, name master);
    [[eosio::action]] void setplan(name coopname, name master, checksum256 project_hash, uint64_t plan_creators_hours, asset plan_expenses, asset plan_hour_cost);
    [[eosio::action]] void expandexpnss(name coopname, checksum256 project_hash, asset additional_expenses);
    
    // CRPS
    [[eosio::action]] void rfrshsegment(name coopname, checksum256 project_hash, name username);

    // Кошельки проектов
    [[eosio::action]] void regshare(name coopname, checksum256 project_hash, name username, eosio::asset user_shares);
    
    
    // Инвестиции
    [[eosio::action]]
    void createinvest(name coopname, name username, checksum256 project_hash, checksum256 invest_hash, asset amount, document2 statement);    
    
    // Программные инвестиции
    [[eosio::action]]
    void createpinv(name coopname, name username, checksum256 invest_hash, asset amount, document2 statement);
    
    // Аллокация программных инвестиций
    [[eosio::action]]
    void allocate(eosio::name coopname, checksum256 project_hash, eosio::asset amount);
    
    [[eosio::action]]
    void diallocate(eosio::name coopname, checksum256 project_hash);
    
    
    // Расходы
    [[eosio::action]]
    void createexpnse(eosio::name coopname, checksum256 expense_hash, checksum256 project_hash, name creator, asset amount, std::string description, document2 statement);
    
    [[eosio::action]]
    void approveexpns(name coopname, name approver, checksum256 expense_hash, document2 approved_statement);
    
    [[eosio::action]]
    void capauthexpns(eosio::name coopname, checksum256 expense_hash, document2 authorization);
    
    [[eosio::action]]
    void capdeclexpns(eosio::name coopname, checksum256 expense_hash);
    
    [[eosio::action]]
    void exppaycnfrm(eosio::name coopname, checksum256 expense_hash);
    
    // Членские взносы
    [[eosio::action]] void fundprog(eosio::name coopname, asset amount, std::string memo);
    [[eosio::action]] void refreshprog(name coopname, name username);
    
    // Возврат из программы
    [[eosio::action]]
    void createwthd3(name coopname, name username, checksum256 withdraw_hash, asset amount, document2 return_statement);
    
    [[eosio::action]]
    void capauthwthd3(eosio::name coopname, checksum256 withdraw_hash, document2 authorization);
    
    [[eosio::action]]
    void approvewthd3(name coopname, name approver, checksum256 withdraw_hash, document2 approved_return_statement);

    [[eosio::action]]
    void capdeclwthd3(name coopname, checksum256 withdraw_hash, std::string reason);
    
    
    // Проектные имущественные взносы
    [[eosio::action]]
    void createpjprp(eosio::name coopname, eosio::name username, checksum256 project_hash, checksum256 property_hash, eosio::asset property_amount, std::string property_description);
    [[eosio::action]]
    void approvepjprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 empty_document);
    [[eosio::action]]
    void declinepjprp(eosio::name coopname, eosio::name username, checksum256 property_hash, std::string reason);
    
    // Программные имущественные взносы
    [[eosio::action]]
    void createpgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, eosio::asset property_amount, std::string property_description, document2 statement);
    [[eosio::action]]
    void approvepgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 approved_statement);
    [[eosio::action]]
    void declinepgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, std::string reason);
    [[eosio::action]]
    void authpgprp(eosio::name coopname, checksum256 property_hash, document2 decision);
    [[eosio::action]]
    void act1pgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 act);
    [[eosio::action]]
    void act2pgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 act);
    
    // Долги
    [[eosio::action]]
    void createdebt(name coopname, name username, checksum256 project_hash, checksum256 debt_hash, asset amount, time_point_sec repaid_at, document2 statement);
    
    [[eosio::action]]
    void approvedebt(eosio::name coopname, eosio::name username, checksum256 debt_hash, document2 approved_statement);

    [[eosio::action]]
    void debtauthcnfr(eosio::name coopname, checksum256 debt_hash, document2 decision);
    
    [[eosio::action]]
    void debtpaycnfrm(name coopname, checksum256 debt_hash);
    
    [[eosio::action]]
    void debtpaydcln(name coopname, checksum256 debt_hash, std::string reason);
    
    [[eosio::action]]
    void declinedebt(name coopname, eosio::name username, checksum256 debt_hash, std::string reason);
    
    [[eosio::action]]
    void settledebt(name coopname, name username, eosio::asset amount, document2 statement);

};
