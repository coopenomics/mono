#pragma once

/**
 * @brief Валидные действия ledger для интеграции с другими контрактами
 */
namespace Ledger {
  
  static const std::set<eosio::name> ledger_actions = {
      "add"_n,      // пополнение счета
      "sub"_n,      // списание со счета
      "transfer"_n, // перевод между счетами
      "create"_n,   // создание заявления на списание
      "auth"_n,     // авторизация списания
      "complete"_n, // завершение операции
      "decline"_n   // отклонение операции
  };

  inline eosio::name get_valid_ledger_action(const eosio::name& action) {
    eosio::check(ledger_actions.contains(action), "Недопустимое имя действия ledger");
    return action;
  }

/**
 * @brief Проверка корректности символа валюты для операций ledger
 * @param amount - проверяемая сумма
 */
inline void check_ledger_symbol(const eosio::asset& amount) {
  eosio::check(amount.symbol == _root_govern_symbol, "Некорректный символ валюты для операций ledger");
}

/**
 * @brief Проверка положительности суммы для операций ledger
 * @param amount - проверяемая сумма
 */
inline void check_positive_amount(const eosio::asset& amount) {
  eosio::check(amount.is_valid(), "Некорректная сумма");
  eosio::check(amount.amount > 0, "Сумма должна быть положительной");
}

/**
 * @brief Структура бухгалтерского счета
 */
struct [[eosio::table, eosio::contract(LEDGER)]] laccount {
  uint64_t id;                    ///< Идентификатор счета
  std::string name;               ///< Название счета
  eosio::asset allocation;        ///< Аллоцированные средства
  eosio::asset writeoff;          ///< Списанные средства

  uint64_t primary_key() const { return id; }
};

/**
 * @brief Типы индексов для таблиц ledger
 */
typedef eosio::multi_index<"accounts"_n, laccount> laccounts_index;

/**
 * @brief Интерфейс для пополнения счета ledger из других контрактов
 * @param coopname - имя кооператива
 * @param account_id - ID счета
 * @param quantity - сумма пополнения
 * @param comment - комментарий
 */
inline void add(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment) {
  eosio::action(
    eosio::permission_level{coopname, "active"_n},
    _ledger,
    "add"_n,
    std::make_tuple(coopname, account_id, quantity, comment)
  ).send();
}

/**
 * @brief Интерфейс для списания со счета ledger из других контрактов
 * @param coopname - имя кооператива
 * @param account_id - ID счета
 * @param quantity - сумма списания
 * @param comment - комментарий
 */
inline void sub(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment) {
  eosio::action(
    eosio::permission_level{coopname, "active"_n},
    _ledger,
    "sub"_n,
    std::make_tuple(coopname, account_id, quantity, comment)
  ).send();
}

/**
 * @brief Интерфейс для перевода между счетами ledger из других контрактов
 * @param coopname - имя кооператива
 * @param from_account_id - ID счета списания
 * @param to_account_id - ID счета зачисления
 * @param quantity - сумма перевода
 * @param comment - комментарий
 */
inline void transfer(eosio::name coopname, uint64_t from_account_id, uint64_t to_account_id, eosio::asset quantity, std::string comment) {
  eosio::action(
    eosio::permission_level{coopname, "active"_n},
    _ledger,
    "transfer"_n,
    std::make_tuple(coopname, from_account_id, to_account_id, quantity, comment)
  ).send();
}

/**
 * @brief Структура для операций ожидающих решения совета
 */
struct [[eosio::table, eosio::contract(LEDGER)]] writeoff_op {
  uint64_t id;                    ///< Идентификатор операции
  eosio::name coopname;           ///< Имя кооператива
  eosio::name username;           ///< Инициатор операции
  uint64_t account_id;            ///< Счет для операции
  eosio::asset quantity;          ///< Сумма операции
  std::string reason;             ///< Обоснование
  document2 document;             ///< Документ обоснования
  checksum256 writeoff_hash;      ///< Хэш операции списания
  eosio::name status;             ///< Статус: pending, approved, declined, paid

  uint64_t primary_key() const { return id; }
  uint64_t by_coop() const { return coopname.value; }
  checksum256 by_hash() const { return writeoff_hash; }
};

typedef eosio::multi_index<"writeoffs"_n, writeoff_op,
  eosio::indexed_by<"bycoop"_n, eosio::const_mem_fun<writeoff_op, uint64_t, &writeoff_op::by_coop>>,
  eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<writeoff_op, checksum256, &writeoff_op::by_hash>>
> writeoffs_index;

/**
 * @brief Получает операцию списания по хэшу
 * @param writeoff_hash Хэш операции списания
 * @return std::optional<writeoff_op> - найденная операция или std::nullopt, если её нет
 */
inline std::optional<writeoff_op> get_writeoff_by_hash(const checksum256 &writeoff_hash) {
    writeoffs_index writeoffs(_ledger, _ledger.value);
    auto hash_idx = writeoffs.get_index<"byhash"_n>();
    
    auto op_iter = hash_idx.find(writeoff_hash);
    if (op_iter == hash_idx.end()) {
        return std::nullopt;
    }
    
    return *op_iter;
}

/**
 * @brief Константы счетов для использования в других контрактах
 */
namespace accounts {
  // Денежные средства
  static constexpr uint64_t CASH = 50;                    // Касса
  static constexpr uint64_t BANK_ACCOUNT = 51;            // Расчетный счет
  
  // Расчеты с пайщиками
  static constexpr uint64_t MEMBER_SETTLEMENTS = 75;       // Расчеты с пайщиками по внесению/возврату паевых взносов
  static constexpr uint64_t MEMBER_DEBT = 751;            // Задолженность пайщиков по внесению взносов в паевой фонд
  static constexpr uint64_t INCOME_ACCRUALS = 752;        // Начисление доходов участникам от предпринимательской деятельности ПО (кооперативные выплаты)
  
  // Паевой фонд
  static constexpr uint64_t SHARE_FUND = 80;              // Паевой фонд (складочный капитал)
  
  // Расчеты с пайщиками (дебиторами и кредиторами)
  static constexpr uint64_t MEMBER_FEES = 761;            // По членским взносам
  static constexpr uint64_t PROPERTY_TRANSFER = 762;       // По передаче имущества для некоммерческой деятельности
  static constexpr uint64_t OTHER_SETTLEMENTS = 763;       // Другие расчеты
  
  // Расчеты по займам
  static constexpr uint64_t LOANS_ISSUED = 583;           // Расчеты по выданным займам
  static constexpr uint64_t LOAN_INTEREST = 911;          // Внесение процентов за пользование займами
  
  // Финансовые вложения из средств ПО
  static constexpr uint64_t SHARES_AND_STAKES = 581;      // Доли, паи и акции в организациях, где участвует ПО
  static constexpr uint64_t SECURITIES = 582;             // Облигации (государственные ценные бумаги)
  
  // Запасы, затраты, расчеты, собственные средства
  static constexpr uint64_t FIXED_ASSETS = 1;             // Основные средства
  static constexpr uint64_t INTANGIBLE_ASSETS = 4;        // Нематериальные активы
  static constexpr uint64_t MATERIALS_GOODS = 10;         // Материалы, товары
  static constexpr uint64_t MAIN_PRODUCTION = 20;         // Основное производство
  static constexpr uint64_t NON_PROFIT_ACTIVITY = 201;    // Некоммерческая деятельность
  static constexpr uint64_t GENERAL_EXPENSES = 26;        // Общехозяйственные расходы (содержание ПО)
  static constexpr uint64_t RESERVES = 63;                // Резервы по сомнительным долгам
  static constexpr uint64_t LONG_TERM_LOANS = 67;         // Расчеты по долгосрочным кредитам и займам
  static constexpr uint64_t TAXES_FEES = 68;              // Расчеты с бюджетом по налогам и сборам
  static constexpr uint64_t SOCIAL_INSURANCE = 69;        // Расчеты по социальному страхованию и обеспечению
  static constexpr uint64_t SALARY = 70;                  // Заработная плата
  static constexpr uint64_t ACCOUNTABLE_PERSONS = 71;     // Расчеты с подотчетными лицами
  static constexpr uint64_t ADDITIONAL_CAPITAL = 83;      // Добавочный капитал
  static constexpr uint64_t FUNDS_PO_1 = 831;            // Фонды ПО (вариант пополнения фондов ПО)
  static constexpr uint64_t CURRENT_YEAR_PROFIT = 841;    // Нераспределенная прибыль (убыток) отчетного года
  static constexpr uint64_t PREVIOUS_YEARS_PROFIT = 842;  // Нераспределенная прибыль (непокрытый убыток) прошлых лет
  static constexpr uint64_t FUNDS_PO_2 = 843;            // Фонды ПО (вариант пополнения фондов ПО)
  static constexpr uint64_t TARGET_RECEIPTS = 86;         // Целевые поступления
  static constexpr uint64_t ENTRANCE_FEES = 861;          // Вступительные взносы
  static constexpr uint64_t RESERVE_FUND = 862;           // Резервный фонд
  static constexpr uint64_t INDIVISIBLE_FUND = 863;       // Неделимый фонд
  static constexpr uint64_t ECONOMIC_ACTIVITY_FUND = 864; // Фонд обеспечения хозяйственной деятельности
  static constexpr uint64_t MUTUAL_SECURITY_FUND = 865;   // Фонд взаимного обеспечения
  static constexpr uint64_t DEVELOPMENT_FUND = 866;       // Фонд развития потребительской кооперации
  static constexpr uint64_t OTHER_INCOME_EXPENSES = 91;   // Прочие доходы и расходы
  static constexpr uint64_t FUTURE_EXPENSES_RESERVE = 96; // Резерв предстоящих расходов
  static constexpr uint64_t FREE_RECEIPT = 981;           // Безвозмездное получение имущества
}

/**
 * @brief Карта счетов для инициализации бухгалтерской книги
 */
static const std::vector<std::tuple<uint64_t, std::string>> ACCOUNT_MAP = {
  {accounts::FIXED_ASSETS, "Основные средства"},
  {accounts::INTANGIBLE_ASSETS, "Нематериальные активы"},
  {accounts::MATERIALS_GOODS, "Материалы, товары"},
  {accounts::MAIN_PRODUCTION, "Основное производство"},
  {accounts::NON_PROFIT_ACTIVITY, "Некоммерческая деятельность"},
  {accounts::GENERAL_EXPENSES, "Общехозяйственные расходы"},
  {accounts::CASH, "Касса"},
  {accounts::BANK_ACCOUNT, "Расчетный счет"},
  {accounts::RESERVES, "Резервы по сомнительным долгам"},
  {accounts::LONG_TERM_LOANS, "Расчеты по долгосрочным кредитам и займам"},
  {accounts::TAXES_FEES, "Расчеты с бюджетом по налогам и сборам"},
  {accounts::SOCIAL_INSURANCE, "Расчеты по социальному страхованию и обеспечению"},
  {accounts::SALARY, "Заработная плата"},
  {accounts::ACCOUNTABLE_PERSONS, "Расчеты с подотчетными лицами"},
  {accounts::MEMBER_SETTLEMENTS, "Расчеты с пайщиками по внесению/возврату паевых взносов"},
  {accounts::SHARE_FUND, "Паевой фонд (складочный капитал)"},
  {accounts::ADDITIONAL_CAPITAL, "Добавочный капитал"},
  {accounts::TARGET_RECEIPTS, "Целевые поступления"},
  {accounts::OTHER_INCOME_EXPENSES, "Прочие доходы и расходы"},
  {accounts::FUTURE_EXPENSES_RESERVE, "Резерв предстоящих расходов"},
  {accounts::SHARES_AND_STAKES, "Доли, паи и акции в организациях"},
  {accounts::SECURITIES, "Облигации (государственные ценные бумаги)"},
  {accounts::LOANS_ISSUED, "Расчеты по выданным займам"},
  {accounts::MEMBER_DEBT, "Задолженность пайщиков по внесению взносов в паевой фонд"},
  {accounts::INCOME_ACCRUALS, "Начисление доходов участникам от предпринимательской деятельности ПО"},
  {accounts::MEMBER_FEES, "По членским взносам"},
  {accounts::PROPERTY_TRANSFER, "По передаче имущества для некоммерческой деятельности"},
  {accounts::OTHER_SETTLEMENTS, "Другие расчеты"},
  {accounts::ENTRANCE_FEES, "Вступительные взносы"},
  {accounts::FUNDS_PO_1, "Фонды ПО (вариант пополнения фондов ПО)"},
  {accounts::CURRENT_YEAR_PROFIT, "Нераспределенная прибыль (убыток) отчетного года"},
  {accounts::PREVIOUS_YEARS_PROFIT, "Нераспределенная прибыль (непокрытый убыток) прошлых лет"},
  {accounts::FUNDS_PO_2, "Фонды ПО (вариант пополнения фондов ПО)"},
  {accounts::RESERVE_FUND, "Резервный фонд"},
  {accounts::INDIVISIBLE_FUND, "Неделимый фонд"},
  {accounts::ECONOMIC_ACTIVITY_FUND, "Фонд обеспечения хозяйственной деятельности"},
  {accounts::MUTUAL_SECURITY_FUND, "Фонд взаимного обеспечения"},
  {accounts::DEVELOPMENT_FUND, "Фонд развития потребительской кооперации"},
  {accounts::LOAN_INTEREST, "Внесение процентов за пользование займами"},
  {accounts::FREE_RECEIPT, "Безвозмездное получение имущества"}
}; 

} 