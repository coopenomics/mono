import type { ReportType } from '../enums/report-type.enum';

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
  /** Данные из ledger (балансы по счетам) */
  ledgerData?: LedgerAccountData[];
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
