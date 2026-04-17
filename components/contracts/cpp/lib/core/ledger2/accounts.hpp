#pragma once

#include <cstdint>
#include <string>
#include <tuple>
#include <vector>

/**
 * @brief Тип бухгалтерского счёта.
 *
 * Определяет, как рассчитывается сальдо и как растёт счёт при проводке:
 * - ACTIVE: остаток — дебетовый. Dr ↑ при поступлении, Cr ↑ при расходе.
 *   balance = debit_turnover − credit_turnover.
 * - PASSIVE: остаток — кредитовый. Cr ↑ при начислении, Dr ↑ при погашении.
 *   balance = credit_turnover − debit_turnover.
 * - ACTIVE_PASSIVE: остаток может быть любого знака; возвращаем
 *   debit − credit (положительный → активный остаток, отрицательный → пассивный).
 *
 * @ingroup public_ledger2_consts
 */
enum class AccountType : uint8_t {
  ACTIVE         = 0,
  PASSIVE        = 1,
  ACTIVE_PASSIVE = 2,
};

/**
 * @brief План счетов ledger2 со смещением *1000.
 *
 * Правило кодирования id: integer(code) * 1000.
 * Примеры: 51 → 51000, 80 → 80000, 86 → 86000,
 *          86.01 (старый id 861) → 861000,
 *          86.02 (старый id 862) → 862000.
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_accounts {
  // Денежные средства (А)
  static constexpr uint64_t CASH                  = 50 * 1000;   ///< 50    — Касса (А)
  static constexpr uint64_t BANK_ACCOUNT          = 51 * 1000;   ///< 51    — Расчётный счёт (А)

  // Расчёты с пайщиками (А-П)
  static constexpr uint64_t MEMBER_SETTLEMENTS    = 75 * 1000;
  static constexpr uint64_t MEMBER_DEBT           = 751 * 1000;
  static constexpr uint64_t INCOME_ACCRUALS       = 752 * 1000;

  // Паевой фонд (П)
  static constexpr uint64_t SHARE_FUND            = 80 * 1000;   ///< 80    — Паевой фонд (П)

  // Расчёты с пайщиками (А-П)
  static constexpr uint64_t MEMBER_FEES           = 761 * 1000;
  static constexpr uint64_t PROPERTY_TRANSFER     = 762 * 1000;
  static constexpr uint64_t OTHER_SETTLEMENTS     = 763 * 1000;

  // Активы
  static constexpr uint64_t FIXED_ASSETS          = 1 * 1000;    ///< 01 (А)
  static constexpr uint64_t INTANGIBLE_ASSETS     = 4 * 1000;    ///< 04 (А)
  static constexpr uint64_t MATERIALS_GOODS       = 10 * 1000;   ///< 10 (А)
  static constexpr uint64_t MAIN_PRODUCTION       = 20 * 1000;   ///< 20 (А)
  static constexpr uint64_t NON_PROFIT_ACTIVITY   = 201 * 1000;
  static constexpr uint64_t GENERAL_EXPENSES      = 26 * 1000;   ///< 26 (А)
  static constexpr uint64_t LOANS_ISSUED          = 583 * 1000;  ///< 58.3 (А)
  static constexpr uint64_t LOAN_INTEREST         = 911 * 1000;
  static constexpr uint64_t FINANCIAL_INVESTMENTS = 58 * 1000;   ///< 58 (А)
  static constexpr uint64_t SHARES_AND_STAKES     = 581 * 1000;
  static constexpr uint64_t SECURITIES            = 582 * 1000;
  static constexpr uint64_t ACCOUNTABLE_PERSONS   = 71 * 1000;   ///< 71 (А-П)

  static constexpr uint64_t DEBTORS_CREDITORS     = 76 * 1000;   ///< 76 (А-П)

  // Пассивы
  static constexpr uint64_t RESERVES              = 63 * 1000;   ///< 63 (П)
  static constexpr uint64_t LONG_TERM_LOANS       = 67 * 1000;   ///< 67    — Расчёты по долгосрочным займам (П)
  static constexpr uint64_t TAXES_FEES            = 68 * 1000;   ///< 68 (П)
  static constexpr uint64_t SOCIAL_INSURANCE      = 69 * 1000;   ///< 69 (П)
  static constexpr uint64_t SALARY                = 70 * 1000;   ///< 70 (П)

  // Капитал, прибыль, фонды (П)
  static constexpr uint64_t ADDITIONAL_CAPITAL    = 83 * 1000;
  static constexpr uint64_t FUNDS_PO_1            = 831 * 1000;
  static constexpr uint64_t CURRENT_YEAR_PROFIT   = 841 * 1000;
  static constexpr uint64_t PREVIOUS_YEARS_PROFIT = 842 * 1000;
  static constexpr uint64_t FUNDS_PO_2            = 843 * 1000;
  static constexpr uint64_t UNDISTRIBUTED_PROFIT  = 84 * 1000;

  // Целевые поступления (П) — субсчета со смещением *1000
  static constexpr uint64_t TARGET_RECEIPTS       = 86 * 1000;   ///< 86    — Целевые поступления (П, родительский)
  static constexpr uint64_t ENTRANCE_FEES         = 861 * 1000;  ///< 86.01 — Вступительные взносы (П)
  static constexpr uint64_t MEMBERSHIP_FEES       = 862 * 1000;  ///< 86.02 — Членские взносы (П)
  static constexpr uint64_t RESERVE_FUND          = 863 * 1000;  ///< 86.3  — Резервный фонд (П)
  static constexpr uint64_t INDIVISIBLE_FUND      = 864 * 1000;
  static constexpr uint64_t ECONOMIC_ACTIVITY_FUND = 865 * 1000;
  static constexpr uint64_t MUTUAL_SECURITY_FUND  = 866 * 1000;
  static constexpr uint64_t DEVELOPMENT_FUND      = 867 * 1000;
  static constexpr uint64_t DELEGATE_FEES_FUND    = 868 * 1000;  ///< 86.8 — Членские взносы делегатов (П)

  // Прочие счета
  static constexpr uint64_t OTHER_INCOME_EXPENSES = 91 * 1000;   ///< 91 (А-П)
  static constexpr uint64_t FUTURE_EXPENSES_RESERVE = 96 * 1000; ///< 96 (П)
  static constexpr uint64_t FUTURE_INCOME         = 98 * 1000;   ///< 98 (П)
  static constexpr uint64_t FREE_RECEIPT          = 981 * 1000;  ///< 98.1 (П)
};

/**
 * @brief Справочник счёта: id → (имя, тип).
 *
 * Покрывает все id, используемые в ACTION_REGISTRY. Заполняется при
 * первой проводке в соответствующий счёт — справочные значения переносятся
 * в запись `accounts` один раз и дальше хранятся там.
 */
struct Ledger2AccountMeta {
  uint64_t     id;
  std::string  name;
  AccountType  type;
};

static const std::vector<Ledger2AccountMeta> LEDGER2_ACCOUNT_MAP = {
  { ledger2_accounts::CASH,                  "Касса",                                        AccountType::ACTIVE },
  { ledger2_accounts::BANK_ACCOUNT,          "Расчётный счёт",                               AccountType::ACTIVE },

  { ledger2_accounts::FIXED_ASSETS,          "Основные средства",                            AccountType::ACTIVE },
  { ledger2_accounts::INTANGIBLE_ASSETS,     "Нематериальные активы",                        AccountType::ACTIVE },
  { ledger2_accounts::MATERIALS_GOODS,       "Материалы и товары",                           AccountType::ACTIVE },
  { ledger2_accounts::MAIN_PRODUCTION,       "Основное производство",                        AccountType::ACTIVE },
  { ledger2_accounts::NON_PROFIT_ACTIVITY,   "Некоммерческая деятельность",                  AccountType::ACTIVE },
  { ledger2_accounts::GENERAL_EXPENSES,      "Общехозяйственные расходы",                    AccountType::ACTIVE },

  { ledger2_accounts::FINANCIAL_INVESTMENTS, "Финансовые вложения из средств ПО",            AccountType::ACTIVE },
  { ledger2_accounts::SHARES_AND_STAKES,     "Паи и акции",                                  AccountType::ACTIVE },
  { ledger2_accounts::SECURITIES,            "Ценные бумаги",                                AccountType::ACTIVE },
  { ledger2_accounts::LOANS_ISSUED,          "Расчёты по выданным займам",                   AccountType::ACTIVE },
  { ledger2_accounts::LOAN_INTEREST,         "Проценты за пользование займами",              AccountType::ACTIVE },
  { ledger2_accounts::ACCOUNTABLE_PERSONS,   "Расчёты с подотчётными лицами",                AccountType::ACTIVE_PASSIVE },

  { ledger2_accounts::RESERVES,              "Резервы под снижение стоимости",               AccountType::PASSIVE },
  { ledger2_accounts::LONG_TERM_LOANS,       "Расчёты по долгосрочным кредитам и займам",    AccountType::PASSIVE },
  { ledger2_accounts::TAXES_FEES,            "Расчёты по налогам и сборам",                  AccountType::PASSIVE },
  { ledger2_accounts::SOCIAL_INSURANCE,      "Расчёты по социальному страхованию",           AccountType::PASSIVE },
  { ledger2_accounts::SALARY,                "Расчёты с персоналом по оплате труда",         AccountType::PASSIVE },

  { ledger2_accounts::SHARE_FUND,            "Паевой фонд (складочный капитал)",             AccountType::PASSIVE },
  { ledger2_accounts::ADDITIONAL_CAPITAL,    "Добавочный капитал",                           AccountType::PASSIVE },
  { ledger2_accounts::FUNDS_PO_1,            "Фонды потребительского общества (83.1)",       AccountType::PASSIVE },
  { ledger2_accounts::FUNDS_PO_2,            "Фонды потребительского общества (84.3)",       AccountType::PASSIVE },
  { ledger2_accounts::UNDISTRIBUTED_PROFIT,  "Нераспределённая прибыль",                     AccountType::PASSIVE },
  { ledger2_accounts::CURRENT_YEAR_PROFIT,   "Нераспределённая прибыль отчётного года",      AccountType::PASSIVE },
  { ledger2_accounts::PREVIOUS_YEARS_PROFIT, "Нераспределённая прибыль прошлых лет",         AccountType::PASSIVE },

  { ledger2_accounts::TARGET_RECEIPTS,       "Целевые поступления",                          AccountType::PASSIVE },
  { ledger2_accounts::ENTRANCE_FEES,         "Вступительные взносы",                         AccountType::PASSIVE },
  { ledger2_accounts::MEMBERSHIP_FEES,       "Членские взносы",                              AccountType::PASSIVE },
  { ledger2_accounts::RESERVE_FUND,          "Резервный фонд",                               AccountType::PASSIVE },
  { ledger2_accounts::INDIVISIBLE_FUND,      "Неделимый фонд",                               AccountType::PASSIVE },
  { ledger2_accounts::ECONOMIC_ACTIVITY_FUND,"Фонд обеспечения хозяйственной деятельности",  AccountType::PASSIVE },
  { ledger2_accounts::MUTUAL_SECURITY_FUND,  "Фонд взаимного обеспечения",                   AccountType::PASSIVE },
  { ledger2_accounts::DEVELOPMENT_FUND,      "Фонд развития потребительской кооперации",     AccountType::PASSIVE },
  { ledger2_accounts::DELEGATE_FEES_FUND,    "Членские взносы делегатов",                    AccountType::PASSIVE },

  { ledger2_accounts::MEMBER_SETTLEMENTS,    "Расчёты с пайщиками по внесению/возврату паевых взносов", AccountType::ACTIVE_PASSIVE },
  { ledger2_accounts::MEMBER_DEBT,           "Задолженность пайщиков по внесению взносов",   AccountType::ACTIVE },
  { ledger2_accounts::INCOME_ACCRUALS,       "Начисление доходов участникам от предпринимательской деятельности ПО", AccountType::PASSIVE },
  { ledger2_accounts::MEMBER_FEES,           "Расчёты по членским взносам",                  AccountType::ACTIVE_PASSIVE },
  { ledger2_accounts::PROPERTY_TRANSFER,     "Передача имущества для некоммерческой деятельности", AccountType::ACTIVE_PASSIVE },
  { ledger2_accounts::OTHER_SETTLEMENTS,     "Другие расчёты",                               AccountType::ACTIVE_PASSIVE },
  { ledger2_accounts::DEBTORS_CREDITORS,     "Расчёты с дебиторами и кредиторами",           AccountType::ACTIVE_PASSIVE },

  { ledger2_accounts::OTHER_INCOME_EXPENSES, "Прочие доходы и расходы",                      AccountType::ACTIVE_PASSIVE },
  { ledger2_accounts::FUTURE_EXPENSES_RESERVE, "Резервы предстоящих расходов",               AccountType::PASSIVE },
  { ledger2_accounts::FUTURE_INCOME,         "Доходы будущих периодов",                      AccountType::PASSIVE },
  { ledger2_accounts::FREE_RECEIPT,          "Безвозмездные поступления",                    AccountType::PASSIVE },
};

inline const Ledger2AccountMeta* ledger2_find_account_meta(uint64_t account_id) {
  for (const auto& row : LEDGER2_ACCOUNT_MAP) {
    if (row.id == account_id) return &row;
  }
  return nullptr;
}

inline std::string ledger2_get_account_name_by_id(uint64_t account_id) {
  const auto* meta = ledger2_find_account_meta(account_id);
  return meta ? meta->name : std::string{};
}

inline AccountType ledger2_get_account_type_by_id(uint64_t account_id) {
  const auto* meta = ledger2_find_account_meta(account_id);
  return meta ? meta->type : AccountType::ACTIVE_PASSIVE;
}
