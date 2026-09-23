// contributor.hpp

#pragma once


#include "../lib/core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include "../lib/index.hpp"

using namespace eosio;
using std::string;

/**
 *  \ingroup public_contracts
 *  @brief  Контракт Contributor управляет вкладами, распределением вознаграждений и выводом средств для участников.
 *  Contributor — это контракт, управляющий вкладами участников, распределением вознаграждений и механизмами вывода средств в системе. Он поддерживает два типа вкладов — интеллектуальные и имущественные, и предоставляет два метода для участников, чтобы вывести свои средства при различных условиях.
 */
class [[eosio::contract]] contributor : public coop_contract {
public:
    using coop_contract::coop_contract;

    /// Очистка отработавших записей по правилам контракта (lib/core/cleanup.hpp); плейбук вызывает её на каждом деплое.
    [[eosio::action]] void cleanup();

    /**
     * @brief Инициализирует контракт, устанавливая глобальное состояние.
     * \ingroup public_actions
     * Это действие должно быть вызвано один раз после развертывания контракта.
     */
    [[eosio::action]]
    void init(name coopname);

    /**
     * @brief Позволяет участнику совершить вклад.
     * \ingroup public_actions
     * @param username Имя аккаунта участника.
     * @param amount Сумма вклада.
     * @param type Тип вклада ("intellect"_n или "property"_n).
     */
    [[eosio::action]]
    void contribute(name coopname, name username, asset amount, name type);

    /**
     * @brief Обновляет состояние участника, применяя накопленные вознаграждения.
     * \ingroup public_actions
     * @param username Имя аккаунта участника.
     */
    [[eosio::action]]
    void refresh(name coopname, name username);

    /**
     * @brief Выводит средства из интеллектуальных вкладов участника.
     *
     * Только участники, совершившие интеллектуальные вклады, могут использовать этот метод.
     * \ingroup public_actions
     * @param username Имя аккаунта участника.
     * @param amount Сумма для вывода.
     */
    [[eosio::action]]
    void withdraw1(name coopname, name username, asset amount); // Вывод для интеллектуальных вкладов

    /**
     * @brief Ставит запрос на вывод средств в очередь для обработки из накопленных членских взносов.
     *
     * Средства, запрошенные к выводу, перестают приносить вознаграждения и обрабатываются по порядку.
     * \ingroup public_actions
     * @param username Имя аккаунта участника.
     * @param amount Сумма для вывода.
     */
    [[eosio::action]]
    void withdraw2(name coopname, name username, asset amount); // Вывод через очередь из членских взносов

    /**
     * @brief Добавляет входящие членские взносы в глобальное состояние.
     *
     * Это действие вызывается системой для добавления средств.
     * \ingroup public_actions
     * @param amount Сумма добавленных членских взносов.
     */
    [[eosio::action]]
    void addfee(name coopname, asset amount); // Добавление входящих членских взносов

private:
    static constexpr symbol TOKEN_SYMBOL = _root_govern_symbol; ///< Символ используемого токена.
    

    /**
     * @brief Структура участника, хранящая данные индивидуального участника.
     * \ingroup public_tables
     */
    struct [[eosio::table]] participant {
        uint64_t id;                                ///< Уникальный ID участника.
        name account;                               ///< Имя аккаунта участника.
        asset share_balance = asset(0, _root_govern_symbol); ///< Баланс долей участника.
        asset pending_rewards = asset(0, _root_symbol); ///< Накопленные вознаграждения.
        asset intellectual_contributions = asset(0, _root_govern_symbol); ///< Сумма интеллектуальных вкладов.
        asset property_contributions = asset(0, _root_govern_symbol); ///< Сумма имущественных вкладов.
        asset total_contributions = asset(0, _root_govern_symbol); ///< Общая сумма вкладов (интеллектуальных + имущественных).
        int64_t reward_per_share_last = 0;          ///< Последнее зафиксированное значение cumulative_reward_per_share (масштабировано).
        asset withdrawed = asset(0, _root_symbol);  ///< Общая сумма, выведенная через withdraw1.
        asset queued_withdrawal = asset(0, _root_symbol); ///< Сумма, запрошенная к выводу через withdraw2.

        uint64_t primary_key() const { return id; }             ///< Основной ключ.
        uint64_t by_account() const { return account.value; }   ///< Вторичный индекс по аккаунту.
    };
    
    typedef eosio::multi_index<"participants"_n, participant,
        indexed_by<"byaccount"_n, const_mem_fun<participant, uint64_t, &participant::by_account>>
    > participants_table; ///< Таблица для хранения участников.

    

    /**
     * @brief Структура глобального состояния, хранящая общие данные контракта.
     * \ingroup public_tables
     */
    struct [[eosio::table]] global_state {
        eosio::name coopname;                                ///< Имя кооператива глобального состояния.
        asset total_shares = asset(0, _root_govern_symbol);    ///< Общая сумма долей всех участников.
        asset total_contributions = asset(0, _root_govern_symbol); ///< Общая сумма всех вкладов.
        asset total_rewards_distributed = asset(0, _root_symbol); ///< Общая сумма распределенных вознаграждений.
        asset total_withdrawed = asset(0, _root_symbol); ///< Общая сумма, выведенная через withdraw1.
        asset total_intellectual_contributions = asset(0, _root_govern_symbol); ///< Общая сумма интеллектуальных вкладов.
        asset total_property_contributions = asset(0, _root_govern_symbol); ///< Общая сумма имущественных вкладов.
        asset accumulated_fees = asset(0, TOKEN_SYMBOL); ///< Накопленные членские взносы.
        int64_t cumulative_reward_per_share = 0;        ///< Накопленное вознаграждение на долю (масштабировано).

        uint64_t primary_key() const { return coopname.value; }     ///< Основной ключ.
    };
    
    typedef eosio::multi_index<"globalstate"_n, global_state> global_state_table; ///< Таблица для хранения глобального состояния.


    /**
     * @brief Структура запроса на вывод для обработки очереди на вывод.
     * \ingroup public_tables
     */
    struct [[eosio::table]] withdrawal_request {
        uint64_t id;                                ///< Уникальный ID запроса на вывод.
        name account;                               ///< Имя аккаунта участника, запрашивающего вывод.
        asset amount = asset(0, TOKEN_SYMBOL);      ///< Запрошенная сумма для вывода.
        uint64_t timestamp;                         ///< Время создания запроса.

        uint64_t primary_key() const { return id; }             ///< Основной ключ.
        uint64_t by_account() const { return account.value; }   ///< Вторичный индекс по аккаунту.
        uint64_t by_timestamp() const { return timestamp; }     ///< Вторичный индекс по времени.
    };

    typedef eosio::multi_index<"withdrawals"_n, withdrawal_request,
        indexed_by<"byaccount"_n, const_mem_fun<withdrawal_request, uint64_t, &withdrawal_request::by_account>>,
        indexed_by<"bytimestamp"_n, const_mem_fun<withdrawal_request, uint64_t, &withdrawal_request::by_timestamp>>
    > withdrawals_table; ///< Таблица для хранения запросов на вывод.

    /**
     * @brief Обрабатывает имущественный вклад.
     *
     * @param username Имя аккаунта участника.
     * @param amount Сумма вклада.
     */
    void process_property(const name& coopname, const name& username, const asset& amount);

    /**
     * @brief Обрабатывает интеллектуальный вклад.
     *
     * @param username Имя аккаунта участника.
     * @param amount Сумма вклада.
     */
    void process_intellectual(const name& coopname, const name& username, const asset& amount);

    /**
     * @brief Обновляет глобальное состояние новыми значениями.
     *
     * @param gs Новое глобальное состояние.
     */
    void update_global_state(const global_state& gs);
        
    /**
     * @brief Получает текущее глобальное состояние.
     *
     * @return Текущее глобальное состояние.
     */
    global_state get_global_state(name coopname) {
        global_state_table global_state_inst(_self, _self.value);
        auto itr = global_state_inst.find(coopname.value);
        eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
        return *itr;
    }

    /**
     * @brief Обрабатывает очередь на вывод, выплачивая запросы, если это возможно.
     */
    void process_withdrawals(const name& coopname); // Обработка очереди на вывод
};

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(contributor::participant, contract);
RAM_PAYER_CLASS(contributor::global_state, contract);
RAM_PAYER_CLASS(contributor::withdrawal_request, contract);
