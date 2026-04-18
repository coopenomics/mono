import type { ChartOfAccountsItemDomainInterface } from '../interfaces/chart-of-accounts-item-domain.interface';
import type { LedgerAccountDomainInterface } from '../interfaces/ledger-account-domain.interface';

/**
 * Доменная сущность для плана счетов кооператива
 * Содержит полный план счетов с константными значениями из блокчейн-контракта
 */
export class ChartOfAccountsEntity {
  /**
   * Константы счетов (идентичны с shared_ledger.hpp)
   */
  public static readonly ACCOUNTS = {
    // Денежные средства
    // CASH: 50, // Касса
    BANK_ACCOUNT: 51, // Расчетный счет

    // Расчеты с пайщиками
    // MEMBER_SETTLEMENTS: 75, // Расчеты с пайщиками по внесению/возврату паевых взносов
    // MEMBER_DEBT: 751, // Задолженность пайщиков по внесению взносов в паевой фонд
    // INCOME_ACCRUALS: 752, // Начисление доходов участникам от предпринимательской деятельности ПО (кооперативные выплаты)

    // Паевой фонд
    SHARE_FUND: 80, // Паевой фонд (складочный капитал)

    // Расчеты с пайщиками (дебиторами и кредиторами)
    // MEMBER_FEES: 761, // По членским взносам
    // PROPERTY_TRANSFER: 762, // По передаче имущества для некоммерческой деятельности
    // OTHER_SETTLEMENTS: 763, // Другие расчеты

    // Расчеты по займам
    // LOANS_ISSUED: 583, // Расчеты по выданным займам
    // LOAN_INTEREST: 911, // Внесение процентов за пользование займами

    // Финансовые вложения из средств ПО
    // FINANCIAL_INVESTMENTS: 58, // Финансовые вложения из средств ПО
    // SHARES_AND_STAKES: 581, // Доли, паи и акции в организациях, где участвует ПО
    // SECURITIES: 582, // Облигации (государственные ценные бумаги)

    // Расчеты с дебиторами и кредиторами
    // DEBTORS_CREDITORS: 76, // Расчеты с дебиторами и кредиторами

    // Запасы, затраты, расчеты, собственные средства
    // FIXED_ASSETS: 1, // Основные средства
    INTANGIBLE_ASSETS: 4, // Нематериальные активы (Epic 1 addendum: для РИД)
    // MATERIALS_GOODS: 10, // Материалы, товары
    // MAIN_PRODUCTION: 20, // Основное производство
    // NON_PROFIT_ACTIVITY: 201, // Некоммерческая деятельность
    // GENERAL_EXPENSES: 26, // Общехозяйственные расходы (содержание ПО)
    // RESERVES: 63, // Резервы по сомнительным долгам
    // LONG_TERM_LOANS: 67, // Расчеты по долгосрочным кредитам и займам
    // TAXES_FEES: 68, // Расчеты с бюджетом по налогам и сборам
    // SOCIAL_INSURANCE: 69, // Расчеты по социальному страхованию и обеспечению
    // SALARY: 70, // Заработная плата
    // ACCOUNTABLE_PERSONS: 71, // Расчеты с подотчетными лицами
    // ADDITIONAL_CAPITAL: 83, // Добавочный капитал
    // FUNDS_PO_1: 831, // Фонды ПО (вариант пополнения фондов ПО)
    // CURRENT_YEAR_PROFIT: 841, // Нераспределенная прибыль (убыток) отчетного года
    // PREVIOUS_YEARS_PROFIT: 842, // Нераспределенная прибыль (непокрытый убыток) прошлых лет
    // FUNDS_PO_2: 843, // Фонды ПО (вариант пополнения фондов ПО)
    // UNDISTRIBUTED_PROFIT: 84, // Нераспределенная прибыль (непокрытый убыток)
    TARGET_RECEIPTS: 86, // Целевые поступления
    ENTRANCE_FEES: 861, // Вступительные взносы
    RESERVE_FUND: 862, // Резервный фонд
    INDIVISIBLE_FUND: 863, // Неделимый фонд
    ECONOMIC_ACTIVITY_FUND: 864, // Фонд обеспечения хозяйственной деятельности
    MUTUAL_SECURITY_FUND: 865, // Фонд взаимного обеспечения
    DEVELOPMENT_FUND: 866, // Фонд развития потребительской кооперации
    // OTHER_INCOME_EXPENSES: 91, // Прочие доходы и расходы
    // FUTURE_EXPENSES_RESERVE: 96, // Резерв предстоящих расходов
    // FUTURE_INCOME: 98, // Доходы будущих периодов
    // FREE_RECEIPT: 981, // Безвозмездное получение имущества
  };

  /**
   * Карта названий счетов (идентична с ACCOUNT_MAP из shared_ledger.hpp)
   */
  private static readonly ACCOUNT_NAMES = new Map<number, string>([
    // [ChartOfAccountsEntity.ACCOUNTS.FIXED_ASSETS, 'Основные средства'],
    [ChartOfAccountsEntity.ACCOUNTS.INTANGIBLE_ASSETS, 'Нематериальные активы'],
    // [ChartOfAccountsEntity.ACCOUNTS.MATERIALS_GOODS, 'Материалы, товары'],
    // [ChartOfAccountsEntity.ACCOUNTS.MAIN_PRODUCTION, 'Основное производство'],
    // [ChartOfAccountsEntity.ACCOUNTS.NON_PROFIT_ACTIVITY, 'Некоммерческая деятельность'],
    // [ChartOfAccountsEntity.ACCOUNTS.GENERAL_EXPENSES, 'Общехозяйственные расходы'],
    // [ChartOfAccountsEntity.ACCOUNTS.CASH, 'Касса'],
    [ChartOfAccountsEntity.ACCOUNTS.BANK_ACCOUNT, 'Расчетный счет'],
    // [ChartOfAccountsEntity.ACCOUNTS.RESERVES, 'Резервы по сомнительным долгам'],
    // [ChartOfAccountsEntity.ACCOUNTS.LONG_TERM_LOANS, 'Расчеты по долгосрочным кредитам и займам'],
    // [ChartOfAccountsEntity.ACCOUNTS.TAXES_FEES, 'Расчеты с бюджетом по налогам и сборам'],
    // [ChartOfAccountsEntity.ACCOUNTS.SOCIAL_INSURANCE, 'Расчеты по социальному страхованию и обеспечению'],
    // [ChartOfAccountsEntity.ACCOUNTS.SALARY, 'Заработная плата'],
    // [ChartOfAccountsEntity.ACCOUNTS.ACCOUNTABLE_PERSONS, 'Расчеты с подотчетными лицами'],
    // [ChartOfAccountsEntity.ACCOUNTS.MEMBER_SETTLEMENTS, 'Расчеты с пайщиками по внесению/возврату паевых взносов'],
    [ChartOfAccountsEntity.ACCOUNTS.SHARE_FUND, 'Паевой фонд (складочный капитал)'],
    // [ChartOfAccountsEntity.ACCOUNTS.ADDITIONAL_CAPITAL, 'Добавочный капитал'],
    [ChartOfAccountsEntity.ACCOUNTS.TARGET_RECEIPTS, 'Целевые поступления'],
    // [ChartOfAccountsEntity.ACCOUNTS.OTHER_INCOME_EXPENSES, 'Прочие доходы и расходы'],
    // [ChartOfAccountsEntity.ACCOUNTS.FUTURE_EXPENSES_RESERVE, 'Резерв предстоящих расходов'],
    // [ChartOfAccountsEntity.ACCOUNTS.FUTURE_INCOME, 'Доходы будущих периодов'],
    // [ChartOfAccountsEntity.ACCOUNTS.SHARES_AND_STAKES, 'Доли, паи и акции в организациях'],
    // [ChartOfAccountsEntity.ACCOUNTS.SECURITIES, 'Облигации (государственные ценные бумаги)'],
    // [ChartOfAccountsEntity.ACCOUNTS.LOANS_ISSUED, 'Расчеты по выданным займам'],
    // [ChartOfAccountsEntity.ACCOUNTS.MEMBER_DEBT, 'Задолженность пайщиков по внесению взносов в паевой фонд'],
    // [ChartOfAccountsEntity.ACCOUNTS.INCOME_ACCRUALS, 'Начисление доходов участникам от предпринимательской деятельности ПО'],
    // [ChartOfAccountsEntity.ACCOUNTS.MEMBER_FEES, 'По членским взносам'],
    // [ChartOfAccountsEntity.ACCOUNTS.PROPERTY_TRANSFER, 'По передаче имущества для некоммерческой деятельности'],
    // [ChartOfAccountsEntity.ACCOUNTS.OTHER_SETTLEMENTS, 'Другие расчеты'],
    // [ChartOfAccountsEntity.ACCOUNTS.DEBTORS_CREDITORS, 'Расчеты с дебиторами и кредиторами'],
    [ChartOfAccountsEntity.ACCOUNTS.ENTRANCE_FEES, 'Вступительные взносы'],
    // [ChartOfAccountsEntity.ACCOUNTS.FUNDS_PO_1, 'Фонды ПО (вариант пополнения фондов ПО)'],
    // [ChartOfAccountsEntity.ACCOUNTS.CURRENT_YEAR_PROFIT, 'Нераспределенная прибыль (убыток) отчетного года'],
    // [ChartOfAccountsEntity.ACCOUNTS.PREVIOUS_YEARS_PROFIT, 'Нераспределенная прибыль (непокрытый убыток) прошлых лет'],
    // [ChartOfAccountsEntity.ACCOUNTS.FUNDS_PO_2, 'Фонды ПО (вариант пополнения фондов ПО)'],
    // [ChartOfAccountsEntity.ACCOUNTS.UNDISTRIBUTED_PROFIT, 'Нераспределенная прибыль (непокрытый убыток)'],
    [ChartOfAccountsEntity.ACCOUNTS.RESERVE_FUND, 'Резервный фонд'],
    [ChartOfAccountsEntity.ACCOUNTS.INDIVISIBLE_FUND, 'Неделимый фонд'],
    [ChartOfAccountsEntity.ACCOUNTS.ECONOMIC_ACTIVITY_FUND, 'Фонд обеспечения хозяйственной деятельности'],
    [ChartOfAccountsEntity.ACCOUNTS.MUTUAL_SECURITY_FUND, 'Фонд взаимного обеспечения'],
    [ChartOfAccountsEntity.ACCOUNTS.DEVELOPMENT_FUND, 'Фонд развития потребительской кооперации'],
    // [ChartOfAccountsEntity.ACCOUNTS.LOAN_INTEREST, 'Внесение процентов за пользование займами'],
    // [ChartOfAccountsEntity.ACCOUNTS.FINANCIAL_INVESTMENTS, 'Финансовые вложения из средств ПО'],
    // [ChartOfAccountsEntity.ACCOUNTS.FREE_RECEIPT, 'Безвозмездное получение имущества'],
  ]);

  /**
   * Преобразует числовой ID счета в строковый формат с точкой для субсчетов
   * Например: 866 -> "86.6", 86 -> "86"
   */
  private static convertAccountIdToDisplayId(id: number): string {
    const idStr = id.toString();

    // Если ID состоит из 3+ цифр и первые две цифры соответствуют основному счету
    if (idStr.length >= 3) {
      const firstTwoDigits = parseInt(idStr.substring(0, 2));
      const remainingDigits = idStr.substring(2);

      // Проверяем, является ли это субсчетом (например, 866 -> 86.6)
      if (this.ACCOUNT_NAMES.has(firstTwoDigits) && remainingDigits.length > 0) {
        return `${firstTwoDigits}.${remainingDigits}`;
      }
    }

    return idStr;
  }

  /**
   * Функция сортировки для правильного отображения счетов и субсчетов
   */
  private static sortAccounts(a: ChartOfAccountsItemDomainInterface, b: ChartOfAccountsItemDomainInterface): number {
    const aParts = a.displayId.split('.');
    const bParts = b.displayId.split('.');

    const aMain = parseInt(aParts[0]);
    const bMain = parseInt(bParts[0]);

    // Сначала сортируем по основному счету
    if (aMain !== bMain) {
      return aMain - bMain;
    }

    // Если основной счет одинаковый, сортируем по субсчету
    const aSub = aParts.length > 1 ? parseInt(aParts[1]) : 0;
    const bSub = bParts.length > 1 ? parseInt(bParts[1]) : 0;

    return aSub - bSub;
  }

  /**
   * Получить полный план счетов с нулевыми значениями
   * @param symbol - символ валюты кооператива для формирования нулевых сумм
   */
  public static getFullChartOfAccounts(symbol: string): ChartOfAccountsItemDomainInterface[] {
    const zeroAmount = `0.0000 ${symbol}`;

    const accounts = Array.from(this.ACCOUNT_NAMES.entries()).map(([id, name]) => ({
      id,
      displayId: this.convertAccountIdToDisplayId(id),
      name,
      available: zeroAmount,
      blocked: zeroAmount,
      writeoff: zeroAmount,
    }));

    // Сортируем счета для правильного отображения
    return accounts.sort(this.sortAccounts);
  }

  /**
   * Получить название счета по его ID
   */
  public static getAccountName(id: number): string {
    return this.ACCOUNT_NAMES.get(id) || 'Неизвестный счет';
  }

  /**
   * Обновить план счетов данными из блокчейна
   * @param chartOfAccounts - базовый план счетов
   * @param ledgerAccounts - активные счета из блокчейна
   */
  public static updateWithLedgerAccountsData(
    chartOfAccounts: ChartOfAccountsItemDomainInterface[],
    ledgerAccounts: LedgerAccountDomainInterface[]
  ): ChartOfAccountsItemDomainInterface[] {
    // Создаем карту активных счетов из блокчейна для быстрого поиска
    const ledgerAccountsMap = new Map<number, LedgerAccountDomainInterface>();
    ledgerAccounts.forEach((ledgerAccount) => {
      ledgerAccountsMap.set(ledgerAccount.id, ledgerAccount);
    });

    // Обновляем план счетов данными из блокчейна
    return chartOfAccounts.map((accountItem) => {
      const ledgerAccount = ledgerAccountsMap.get(accountItem.id);
      if (ledgerAccount) {
        return {
          ...accountItem,
          available: ledgerAccount.available,
          blocked: ledgerAccount.blocked,
          writeoff: ledgerAccount.writeoff,
        };
      }

      return accountItem; // Возвращаем с нулевыми значениями
    });
  }
}
