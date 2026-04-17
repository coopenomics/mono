import type { ReportType } from '../enums/report-type.enum';

/** Кто подписывает отчёт. */
export type SignerType = 'chairman' | 'representative';

export interface BalanceCorrectionInput {
  /** Идентификатор счёта в человеко-читаемом виде: "51", "80", "86.01". */
  accountDisplayId: string;
  /** Остаток на конец предыдущего года (год N-1), в рублях (полная сумма, не тыс.). */
  balancePrevious: number;
  /** Остаток на конец года N-2, в рублях. */
  balancePrePrevious: number;
}

export interface ReportInput {
  reportType: ReportType;
  year: number;
  /** Квартал (1-4) или месяц (1-12) */
  period?: number;
  inn: string;
  kpp: string;
  orgName: string;
  ogrn: string;
  okved: string;
  okpo?: string;
  /** ОКФС — форма собственности */
  okfs: string;
  /** ОКОПФ — организационно-правовая форма */
  okopf: string;
  /** ОКТМО — код муниципального образования */
  oktmo: string;
  /** Адрес места нахождения */
  address?: string;
  /** Номер телефона */
  phone?: string;
  /** ФИО подписанта */
  signerFio: { lastName: string; firstName: string; middleName?: string };
  /** Тип подписанта (по умолчанию 'chairman', что даёт ПрПодп=1). */
  signerType?: SignerType;
  /** Для representative: описание доверенности (пишется в <СвПред НаимДок="..."/>). */
  signerRepDoc?: string;
  /** Данные из ledger2::accounts (балансы по счетам, в рублях). */
  ledgerData?: LedgerAccountData[];
  /** Ручные корректировки прошлых периодов (для BUHOTCH). */
  corrections?: BalanceCorrectionInput[];
  /** Номер корректировки декларации (0 — первичная). */
  correctionNumber?: number;
  /** СНИЛС председателя (для ПСВ) */
  signerSnils?: string;
}

export interface LedgerAccountData {
  accountId: number;
  name: string;
  /** Сальдо на отчётную дату текущего периода */
  balanceCurrent: number;
  /** Сальдо на отчётную дату предыдущего периода */
  balancePrevious: number;
  /** Сальдо на отчётную дату года, предшествующего предыдущему */
  balancePrePrevious: number;
}

export interface ReportOutput {
  reportType: ReportType;
  xml: string;
  fileName: string;
  errors: string[];
  isValid: boolean;
}

export interface IReportGenerator {
  readonly reportType: ReportType;
  generate(input: ReportInput): ReportOutput;
  generateFileName(input: ReportInput): string;
}
