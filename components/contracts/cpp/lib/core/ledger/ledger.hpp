#pragma once

#include <optional>
#include <set>
#include <string>
#include <tuple>
#include <vector>

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"

/**
 * @brief Класс Ledger для интеграции с ledger контрактом
 * @details Требует domain/index.hpp (writeoff_op и др. таблицы ledger) — подключать раньше.
 */
class Ledger {
public:
  
  /**
   * @brief Валидные действия ledger для интеграции с другими контрактами
   */
  static const std::set<eosio::name> ledger_actions;
  
  /**
   * @brief Проверка корректности действия ledger
   */
  static eosio::name get_valid_ledger_action(const eosio::name& action);

  /**
   * @brief Проверка корректности символа валюты для операций ledger
   */
  static void check_ledger_symbol(const eosio::asset& amount);

  /**
   * @brief Проверка положительности суммы для операций ledger
   */
  static void check_positive_amount(const eosio::asset& amount);

  // Основные операции
  static void add(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  static void sub(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  static void transfer(eosio::name actor, eosio::name coopname, uint64_t from_account_id, uint64_t to_account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  
  // Операции блокировки/разблокировки
  static void block(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  static void unblock(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  
  // Атомарные операции списания
  static void writeoff(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  static void writeoffcnsl(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  
  // Специализированные методы для членских взносов
  static void add_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  static void sub_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  static void block_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);
  static void unblock_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username);

  /**
   * @brief Получает операцию списания по хэшу
   */
  static std::optional<writeoff_op> get_writeoff_by_hash(const checksum256 &writeoff_hash);
  
  /**
   * @brief Получает название счета по его ID из ACCOUNT_MAP
   */
  static std::string get_account_name_by_id(uint64_t account_id);

  /**
   * @brief Константы счетов
   * @ingroup public_consts
   * @ingroup public_ledger_consts

   */
  struct accounts {
    // Денежные средства
    static constexpr uint64_t CASH = 50;                    ///< Касса
    static constexpr uint64_t BANK_ACCOUNT = 51;            ///< Расчетный счет
    
    // Расчеты с пайщиками
    static constexpr uint64_t MEMBER_SETTLEMENTS = 75;       ///< Расчеты с пайщиками по внесению/возврату паевых взносов
    static constexpr uint64_t MEMBER_DEBT = 751;            ///< Задолженность пайщиков по внесению взносов в паевой фонд
    static constexpr uint64_t INCOME_ACCRUALS = 752;        ///< Начисление доходов участникам от предпринимательской деятельности ПО (кооперативные выплаты)
    
    // Паевой фонд
    static constexpr uint64_t SHARE_FUND = 80;              ///< Паевой фонд (складочный капитал)
    
    // Расчеты с пайщиками (дебиторами и кредиторами)
    static constexpr uint64_t MEMBER_FEES = 761;            ///< По членским взносам
    static constexpr uint64_t PROPERTY_TRANSFER = 762;       ///< По передаче имущества для некоммерческой деятельности
    static constexpr uint64_t OTHER_SETTLEMENTS = 763;       ///< Другие расчеты
    
    // Расчеты по займам
    static constexpr uint64_t LOANS_ISSUED = 583;           ///< Расчеты по выданным займам
    static constexpr uint64_t LOAN_INTEREST = 911;          ///< Внесение процентов за пользование займами
    
    // Финансовые вложения из средств ПО
    static constexpr uint64_t FINANCIAL_INVESTMENTS = 58;   ///< Финансовые вложения из средств ПО
    static constexpr uint64_t SHARES_AND_STAKES = 581;      ///< Доли, паи и акции в организациях, где участвует ПО
    static constexpr uint64_t SECURITIES = 582;             ///< Облигации (государственные ценные бумаги)
    
    // Расчеты с дебиторами и кредиторами
    static constexpr uint64_t DEBTORS_CREDITORS = 76;       ///< Расчеты с дебиторами и кредиторами
    
    // Запасы, затраты, расчеты, собственные средства
    static constexpr uint64_t FIXED_ASSETS = 1;             ///< Основные средства
    static constexpr uint64_t INTANGIBLE_ASSETS = 4;        ///< Нематериальные активы
    static constexpr uint64_t MATERIALS_GOODS = 10;         ///< Материалы, товары
    static constexpr uint64_t MAIN_PRODUCTION = 20;         ///< Основное производство
    static constexpr uint64_t NON_PROFIT_ACTIVITY = 201;    ///< Некоммерческая деятельность
    static constexpr uint64_t GENERAL_EXPENSES = 26;        ///< Общехозяйственные расходы (содержание ПО)
    static constexpr uint64_t RESERVES = 63;                ///< Резервы по сомнительным долгам
    static constexpr uint64_t LONG_TERM_LOANS = 67;         ///< Расчеты по долгосрочным кредитам и займам
    static constexpr uint64_t TAXES_FEES = 68;              ///< Расчеты с бюджетом по налогам и сборам
    static constexpr uint64_t SOCIAL_INSURANCE = 69;        ///< Расчеты по социальному страхованию и обеспечению
    static constexpr uint64_t SALARY = 70;                  ///< Заработная плата
    static constexpr uint64_t ACCOUNTABLE_PERSONS = 71;     ///< Расчеты с подотчетными лицами
    static constexpr uint64_t ADDITIONAL_CAPITAL = 83;      ///< Добавочный капитал
    static constexpr uint64_t FUNDS_PO_1 = 831;            ///< Фонды ПО (вариант пополнения фондов ПО)
    static constexpr uint64_t CURRENT_YEAR_PROFIT = 841;    ///< Нераспределенная прибыль (убыток) отчетного года
    static constexpr uint64_t PREVIOUS_YEARS_PROFIT = 842;  ///< Нераспределенная прибыль (непокрытый убыток) прошлых лет
    static constexpr uint64_t FUNDS_PO_2 = 843;            ///< Фонды ПО (вариант пополнения фондов ПО)
    static constexpr uint64_t UNDISTRIBUTED_PROFIT = 84;    ///< Нераспределенная прибыль (непокрытый убыток)
    static constexpr uint64_t TARGET_RECEIPTS = 86;         ///< Целевые поступления
    static constexpr uint64_t ENTRANCE_FEES = 861;          ///< Вступительные взносы
    static constexpr uint64_t RESERVE_FUND = 862;           ///< Резервный фонд
    static constexpr uint64_t INDIVISIBLE_FUND = 863;       ///< Неделимый фонд
    static constexpr uint64_t ECONOMIC_ACTIVITY_FUND = 864; ///< Фонд обеспечения хозяйственной деятельности
    static constexpr uint64_t MUTUAL_SECURITY_FUND = 865;   ///< Фонд социально-экономического взаимодействия и социального обеспечения (до 16.11.2026 — «Фонд взаимного обеспечения»)
    static constexpr uint64_t DEVELOPMENT_FUND = 866;       ///< Фонд развития потребительской кооперации
    static constexpr uint64_t DELEGATE_FEES_FUND = 867;          ///< Членские взносы делегатов
    static constexpr uint64_t OTHER_INCOME_EXPENSES = 91;   ///< Прочие доходы и расходы
    static constexpr uint64_t FUTURE_EXPENSES_RESERVE = 96; ///< Резерв предстоящих расходов
    static constexpr uint64_t FUTURE_INCOME = 98;           ///< Доходы будущих периодов
    static constexpr uint64_t FREE_RECEIPT = 981;           ///< Безвозмездное получение имущества
  };
};

/**
 * @brief Карта счетов для инициализации бухгалтерской книги
 * СОХРАНЯЕМ - используется для получения названий при автосоздании счетов
 * @ingroup public_consts
 * @ingroup public_ledger_consts

 */
static const std::vector<std::tuple<uint64_t, std::string>> ACCOUNT_MAP = {
  {Ledger::accounts::FIXED_ASSETS, "Основные средства"},
  {Ledger::accounts::INTANGIBLE_ASSETS, "Нематериальные активы"},
  {Ledger::accounts::MATERIALS_GOODS, "Материалы, товары"},
  {Ledger::accounts::MAIN_PRODUCTION, "Основное производство"},
  {Ledger::accounts::NON_PROFIT_ACTIVITY, "Некоммерческая деятельность"},
  {Ledger::accounts::GENERAL_EXPENSES, "Общехозяйственные расходы"},
  {Ledger::accounts::CASH, "Касса"},
  {Ledger::accounts::BANK_ACCOUNT, "Расчетный счет"},
  {Ledger::accounts::RESERVES, "Резервы по сомнительным долгам"},
  {Ledger::accounts::LONG_TERM_LOANS, "Расчеты по долгосрочным кредитам и займам"},
  {Ledger::accounts::TAXES_FEES, "Расчеты с бюджетом по налогам и сборам"},
  {Ledger::accounts::SOCIAL_INSURANCE, "Расчеты по социальному страхованию и обеспечению"},
  {Ledger::accounts::SALARY, "Заработная плата"},
  {Ledger::accounts::ACCOUNTABLE_PERSONS, "Расчеты с подотчетными лицами"},
  {Ledger::accounts::MEMBER_SETTLEMENTS, "Расчеты с пайщиками по внесению/возврату паевых взносов"},
  {Ledger::accounts::SHARE_FUND, "Паевой фонд (складочный капитал)"},
  {Ledger::accounts::ADDITIONAL_CAPITAL, "Добавочный капитал"},
  {Ledger::accounts::TARGET_RECEIPTS, "Целевые поступления"},
  {Ledger::accounts::OTHER_INCOME_EXPENSES, "Прочие доходы и расходы"},
  {Ledger::accounts::FUTURE_EXPENSES_RESERVE, "Резерв предстоящих расходов"},
  {Ledger::accounts::FUTURE_INCOME, "Доходы будущих периодов"},
  {Ledger::accounts::SHARES_AND_STAKES, "Доли, паи и акции в организациях"},
  {Ledger::accounts::SECURITIES, "Облигации (государственные ценные бумаги)"},
  {Ledger::accounts::LOANS_ISSUED, "Расчеты по выданным займам"},
  {Ledger::accounts::MEMBER_DEBT, "Задолженность пайщиков по внесению взносов в паевой фонд"},
  {Ledger::accounts::INCOME_ACCRUALS, "Начисление доходов участникам от предпринимательской деятельности ПО"},
  {Ledger::accounts::MEMBER_FEES, "По членским взносам"},
  {Ledger::accounts::PROPERTY_TRANSFER, "По передаче имущества для некоммерческой деятельности"},
  {Ledger::accounts::OTHER_SETTLEMENTS, "Другие расчеты"},
  {Ledger::accounts::DEBTORS_CREDITORS, "Расчеты с дебиторами и кредиторами"},
  {Ledger::accounts::ENTRANCE_FEES, "Вступительные взносы"},
  {Ledger::accounts::FUNDS_PO_1, "Фонды ПО (вариант пополнения фондов ПО)"},
  {Ledger::accounts::CURRENT_YEAR_PROFIT, "Нераспределенная прибыль (убыток) отчетного года"},
  {Ledger::accounts::PREVIOUS_YEARS_PROFIT, "Нераспределенная прибыль (непокрытый убыток) прошлых лет"},
  {Ledger::accounts::FUNDS_PO_2, "Фонды ПО (вариант пополнения фондов ПО)"},
  {Ledger::accounts::UNDISTRIBUTED_PROFIT, "Нераспределенная прибыль (непокрытый убыток)"},
  {Ledger::accounts::RESERVE_FUND, "Резервный фонд"},
  {Ledger::accounts::INDIVISIBLE_FUND, "Неделимый фонд"},
  {Ledger::accounts::ECONOMIC_ACTIVITY_FUND, "Фонд обеспечения хозяйственной деятельности"},
  {Ledger::accounts::MUTUAL_SECURITY_FUND, "Фонд социально-экономического взаимодействия и социального обеспечения"},
  {Ledger::accounts::DEVELOPMENT_FUND, "Фонд развития потребительской кооперации"},
  {Ledger::accounts::DELEGATE_FEES_FUND, "Фонд членских взносов делегатов"},
  {Ledger::accounts::LOAN_INTEREST, "Внесение процентов за пользование займами"},
  {Ledger::accounts::FINANCIAL_INVESTMENTS, "Финансовые вложения из средств ПО"},
  {Ledger::accounts::FREE_RECEIPT, "Безвозмездное получение имущества"}
}; 

// Реализация статических методов класса Ledger

/**
 * @brief Валидные действия ledger для интеграции с другими контрактами
 * @ingroup public_consts
 * @ingroup public_ledger_consts

 */
const std::set<eosio::name> Ledger::ledger_actions = {
    "add"_n,      ///< пополнение счета
    "sub"_n,      ///< списание со счета
    "block"_n,    ///< блокировка средств
    "unblock"_n,  ///< разблокировка средств
    "writeoff"_n, ///< атомарное списание средств
    "writeoffcnsl"_n,  ///< атомарная отмена списания
    "create"_n,   ///< создание заявления на списание
    "auth"_n,     ///< авторизация списания
    "complete"_n, ///< завершение операции
    "decline"_n   ///< отклонение операции
};

inline eosio::name Ledger::get_valid_ledger_action(const eosio::name& action) {
  eosio::check(ledger_actions.contains(action), "Недопустимое имя действия ledger");
  return action;
}

inline void Ledger::check_ledger_symbol(const eosio::asset& amount) {
  eosio::check(amount.symbol == _root_govern_symbol, "Некорректный символ валюты для операций ledger");
}

inline void Ledger::check_positive_amount(const eosio::asset& amount) {
  eosio::check(amount.is_valid(), "Некорректная сумма");
  eosio::check(amount.amount > 0, "Сумма должна быть положительной");
}

inline std::string Ledger::get_account_name_by_id(uint64_t account_id) {
  for (const auto& account_data : ACCOUNT_MAP) {
    if (std::get<0>(account_data) == account_id) {
      return std::get<1>(account_data);
    }
  }
  return "Неизвестный счет";
}

/**
 * @brief Добавить средства на счёт кооператива
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param account_id Идентификатор счёта
 * @param quantity Сумма для добавления
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::add(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _ledger,
    get_valid_ledger_action("add"_n),
    std::make_tuple(coopname, account_id, quantity, comment, hash, username)
  ).send();
}

/**
 * @brief Уменьшить средства на счёте кооператива
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param account_id Идентификатор счёта
 * @param quantity Сумма для вычитания
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::sub(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _ledger,
    get_valid_ledger_action("sub"_n),
    std::make_tuple(coopname, account_id, quantity, comment, hash, username)
  ).send();
}

/**
 * @brief Перевести средства между счетами кооператива
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param from_account_id Идентификатор счёта отправителя
 * @param to_account_id Идентификатор счёта получателя
 * @param quantity Сумма перевода
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::transfer(eosio::name actor, eosio::name coopname, uint64_t from_account_id, uint64_t to_account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  add(actor, coopname, from_account_id, quantity, comment, hash, username);
  sub(actor, coopname, to_account_id, quantity, comment, hash, username);
}

/**
 * @brief Заблокировать средства на счёте кооператива
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param account_id Идентификатор счёта
 * @param quantity Сумма для блокировки
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::block(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _ledger,
    get_valid_ledger_action("block"_n),
    std::make_tuple(coopname, account_id, quantity, comment, hash, username)
  ).send();
}

/**
 * @brief Разблокировать средства на счёте кооператива
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param account_id Идентификатор счёта
 * @param quantity Сумма для разблокировки
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::unblock(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _ledger,
    get_valid_ledger_action("unblock"_n),
    std::make_tuple(coopname, account_id, quantity, comment, hash, username)
  ).send();
}

/**
 * @brief Списать средства со счёта кооператива
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param account_id Идентификатор счёта
 * @param quantity Сумма для списания
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::writeoff(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _ledger,
    get_valid_ledger_action("writeoff"_n),
    std::make_tuple(coopname, account_id, quantity, comment, hash, username)
  ).send();
}

/**
 * @brief Отменить списание средств со счёта кооператива
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param account_id Идентификатор счёта
 * @param quantity Сумма для отмены списания
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::writeoffcnsl(eosio::name actor, eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _ledger,
    get_valid_ledger_action("writeoffcnsl"_n),
    std::make_tuple(coopname, account_id, quantity, comment, hash, username)
  ).send();
}

/**
 * @brief Добавить членский взнос на счёт поступлений
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param quantity Сумма для добавления
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::add_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  add(actor, coopname, accounts::TARGET_RECEIPTS, quantity, comment, hash, username);
}

/**
 * @brief Вычесть членский взнос со счёта поступлений
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param quantity Сумма для вычитания
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::sub_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  sub(actor, coopname, accounts::TARGET_RECEIPTS, quantity, comment, hash, username);
}

/**
 * @brief Заблокировать членский взнос на счёте поступлений
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param quantity Сумма для блокировки
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::block_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  block(actor, coopname, accounts::TARGET_RECEIPTS, quantity, comment, hash, username);
}

/**
 * @brief Разблокировать членский взнос на счёте поступлений
 * @param actor Аккаунт, выполняющий действие
 * @param coopname Название кооператива
 * @param quantity Сумма для разблокировки
 * @param comment Комментарий к операции
 * @param hash Хэш документа-основания операции
 * @param username Имя пользователя-инициатора операции
 */
inline void Ledger::unblock_membership_fee(eosio::name actor, eosio::name coopname, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  unblock(actor, coopname, accounts::TARGET_RECEIPTS, quantity, comment, hash, username);
}

inline std::optional<writeoff_op> Ledger::get_writeoff_by_hash(const checksum256 &writeoff_hash) {
    writeoffs_index writeoffs(_ledger, _ledger.value);
    auto hash_idx = writeoffs.get_index<"byhash"_n>();
    
    auto op_iter = hash_idx.find(writeoff_hash);
    if (op_iter == hash_idx.end()) {
        return std::nullopt;
    }
    
    return *op_iter;
} 