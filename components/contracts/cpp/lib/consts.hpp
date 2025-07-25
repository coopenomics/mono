#pragma once

using namespace eosio;


// /**
//  * @mainpage Обзор контрактов
//  * - _registrator - контракт регистратора аккаунтов, физических и юридических лиц
//  * - _marketplace - контракт обмена всё на всё
//  * - _soviet - контракт советов кооперативов
//  * - _system - системный контракт делегатов при АНО
//  */

/**
\defgroup public_contracts Контракты
\brief Контракты Кооперативной Экономики
*
* Группа содержит контракты, предназначенные для кооперативной экономики. Контракты описывают основные логические 
* единицы и функциональность для управления и взаимодействия в рамках кооперативной экосистемы. От регистрации 
* участников до обменных операций - все аспекты кооперативной деятельности регулируются этими контрактами.
*/

/**
\defgroup public_consts Константы
\brief Константы контрактов
*
* В этой группе представлены основные константы, используемые в контрактах кооперативной экономики. 
* Константы обеспечивают стабильность и предсказуемость поведения контрактов, а также упрощают 
* процесс чтения и понимания кода.
*/

/**
\defgroup public_actions Действия
\brief Методы действий контрактов
*
* Действия представляют собой методы, которые можно вызывать в контрактах. Они отвечают за 
* выполнение определенных задач, таких как создание аккаунта, обновление информации или 
* осуществление транзакции. Эта группа описывает все доступные действия, которые предоставляют 
* контракты кооперативной экономики.
*/

/**
\defgroup public_tables Таблицы
\brief Структуры таблиц контрактов
*
* Таблицы в контрактах EOSIO используются для хранения состояния контракта на блокчейне. В этой группе 
* представлены основные структуры данных, которые используются в таблицах контрактов кооперативной экономики. 
* От сведений о участниках до деталей транзакций - все это сохраняется в таблицах.
*/

// /**
// \defgroup public_structures Структуры
// \brief Структуры контрактов
// *
// * Структуры - это фундаментальные блоки данных, используемые для описания и хранения информации в контрактах. 
// * Эта группа содержит описание основных структур, используемых в контрактах кооперативной экономики. 
// * Они обеспечивают четкую организацию данных и упрощают взаимодействие с контрактом.
// */

//registrator
static constexpr eosio::name _regaccount_action = "joincoop"_n;

//wallet
static constexpr eosio::name _deposit_action = "deposit"_n;
static constexpr eosio::name _withdraw_action = "withdraw"_n;

//funds
static constexpr eosio::name _afund_withdraw_action = "subaccum"_n;
static constexpr eosio::name _efund_withdraw_action = "subexp"_n;

//freedecision
static constexpr eosio::name _free_decision_action = "freedecision"_n;

// marketplace linked actions
static constexpr eosio::name _change_action = "change"_n;
static constexpr eosio::name _product_contribution_action = "productcntr"_n;
static constexpr eosio::name _product_return_action = "productrtrn"_n;

// capitalization linked actions
static constexpr eosio::name _capital_contributor_authorize_action = "capregcontr"_n;
static constexpr eosio::name _capital_invest_authorize_action = "capauthinvst"_n;
static constexpr eosio::name _capital_withdraw_from_result_authorize_action = "capauthwthd1"_n;
static constexpr eosio::name _capital_expense_authorize_action = "capauthexpns"_n;

static constexpr eosio::name _capital_withdraw_from_project_authorize_action = "capauthwthd2"_n;

static constexpr eosio::name _capital_withdraw_from_program_authorize_action = "capauthwthd3"_n;


//capital::debts

static constexpr eosio::name _result_action = "result"_n;

//program_types
static constexpr eosio::name _wallet_program = "wallet"_n;
static constexpr eosio::name _marketplace_program = "marketplace"_n;
static constexpr eosio::name _source_program = "source"_n;
static constexpr eosio::name _capital_program = "capital"_n;


static const std::set<eosio::name> soviet_actions = {
    "joincoop"_n, //регистрация пайщика
    
    //MEET
    "creategm"_n,//предложение повестки планового общего собрание
    "completegm"_n, //решение общего собрания пайщиков
    "ballot"_n, //бюллетень участника общего собрания пайщиков
    "gmnotify"_n, //уведомление участника общего собрания пайщиков
    //CAPITAL
    "capitalinvst"_n, //заявление на инвестиции по договору УХД
    "createresult"_n, //клайм прироста капитализации из задания
    "createdebt"_n, //взять ссуду под залог будущего задания
    "capresexpns"_n, //произвести выплату по расходам задания
    "capwthdrprog"_n, //произвести возврат накопленных членских взносов по программе на капиталиста
    "capwthdrproj"_n, //произвести возврат накопленных членских взносов по проекту на актора
    "capwthdrres"_n, //произвести возврат из задания

    //WALLET
    "createwthd"_n, //создать заявление на возврат паевого взноса
    
    //LEDGER
    "ledgerwthd"_n, //заявление на списание со счета через ledger
    
    //MARKETPLACE
    "authoffs2c"_n, //заявление на взнос имуществом
    "authoffc2r"_n, //заявление на возврат паевого взноса имуществом
};

//program_ids
static constexpr uint64_t _wallet_program_id = 1;
static constexpr uint64_t _marketplace_program_id = 2;
static constexpr uint64_t _capital_program_id = 3;

static constexpr int64_t REWARD_SCALE = 100000000; ///< Масштабный коэффициент для вознаграждений (1e8).

#define HUNDR_PERCENTS 1000000
#define ONE_PERCENT 10000


// Дефайны для основной сети
#define ANO "ano"
#define GATEWAY "gateway"
#define DRAFT "draft"
#define MARKETPLACE "marketplace"
#define SOVIET "soviet"
#define REGISTRATOR "registrator"
#define SYSTEM "eosio"
#define FUND "fund"
#define BRANCH "branch"
#define CAPITAL "capital"
#define WALLET "wallet"
#define LOAN "loan"
#define LEDGER "ledger"
#define MEET "meet"
#define LEDGER "ledger"

/**
* @ingroup public_consts
* @{ 
*/
    static constexpr eosio::name _provider = "voskhod"_n;
    static constexpr eosio::name _provider_chairman = "ant"_n;
    
    static constexpr eosio::name _capital = "capital"_n;
    static constexpr eosio::name _ano = "ano"_n;
    static constexpr eosio::name _gateway = "gateway"_n;
    static constexpr eosio::name _wallet = "wallet"_n;
    static constexpr eosio::name _draft = "draft"_n;
    static constexpr eosio::name _marketplace = "marketplace"_n;
    static constexpr eosio::name _soviet = "soviet"_n;
    static constexpr eosio::name _registrator = "registrator"_n;
    static constexpr eosio::name _system = "eosio"_n;
    static constexpr eosio::name _fund = "fund"_n;
    static constexpr eosio::name _branch = "branch"_n;
    static constexpr eosio::name _loan = "loan"_n;
    static constexpr eosio::name _meet = "meet"_n;
    static constexpr eosio::name _ledger = "ledger"_n;
    static constexpr eosio::name _power_account = "eosio.power"_n;
    static constexpr eosio::name _saving_account = "eosio.saving"_n;
    
    
    
    static std::vector<name> contracts_whitelist = {
        "ano"_n,
        "gateway"_n,
        "draft"_n,
        "marketplace"_n,
        "soviet"_n,
        "registrator"_n,
        "eosio"_n,
        "fund"_n,
        "branch"_n,
        "capital"_n,
        "wallet"_n,
        "meet"_n,
        "loan"_n,
        "contributor"_n,
        "eosio.token"_n,
        "eosio.msig"_n,
        "eosio.wrap"_n,
        "eosio.power"_n,
        "eosio.saving"_n,
        "ledger"_n
        // Добавьте остальные стандартные или пользовательские контракты по необходимости
      };

    static std::vector<name> token_whitelist = {
        "eosio"_n,
        "eosio.vpay"_n,
        "eosio.saving"_n,
        "eosio.bpay"_n,
        "eosio.saving"_n,
        "eosio.power"_n,
        "eosio.ram"_n,
        "eosio.stake"_n,
        _provider
        // Добавьте другие аккаунты в список по мере необходимости
      };    


    static constexpr eosio::symbol _root_symbol = eosio::symbol(eosio::symbol_code("AXON"), 4); /*!< системный токен */
    static constexpr eosio::symbol _root_govern_symbol = eosio::symbol(eosio::symbol_code("RUB"), 4); 
    static const eosio::asset _provider_initial = eosio::asset(1000000, _root_govern_symbol);
    static const eosio::asset _provider_minimum = eosio::asset(3000000, _root_govern_symbol);
    
    static const eosio::asset _provider_org_initial = eosio::asset(10000000, _root_govern_symbol);
    static const eosio::asset _provider_org_minimum = eosio::asset(30000000, _root_govern_symbol);

    static constexpr eosio::name _root_contract = "eosio.token"_n; /*!< системный контракт */
    static constexpr eosio::symbol RAM_symbol{"RAM", 0}; /*!< токен рынка оперативной памяти */
    static constexpr eosio::symbol _ramcore_symbol = eosio::symbol(eosio::symbol_code("RAMCORE"),4); /*!< идентификационный токен рынка оперативной памяти */
    static constexpr uint64_t _ram_price_per_byte = 1; /*!< стоимость 1 байта в эпсилон AXON (0.0001) */
    
    static constexpr uint64_t _register_amount = 10000; /*!< стоимость регистрации нового аккаунта */ 

    static constexpr uint64_t _signature_expiration = 86400 * 365 * 2;
    static constexpr uint64_t _auction_name_length_limit = 12;

    static constexpr uint64_t _deposit_expiration_seconds = 3600;
    
    static constexpr uint64_t _decision_expiration = 3 * 86400;
    
    static constexpr uint64_t _producers_percent = 900000; // 90%
    static constexpr uint64_t _fund_percent = 100000; // 10%
/**
* @}
*/

