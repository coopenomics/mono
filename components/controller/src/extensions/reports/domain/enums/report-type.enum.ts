import { t } from '../../i18n';
export enum ReportType {
  BUHOTCH = 'buhotch',       // Бухгалтерский баланс — ежегодно до 31 марта
  NDFL6 = 'ndfl6',           // 6-НДФЛ — ежеквартально до 25 числа следующего месяца
  RSV = 'rsv',               // РСВ — ежеквартально до 25 числа следующего месяца  
  PSV = 'psv',               // ПСВ — ежемесячно до 25 числа следующего месяца
  DUSN = 'dusn',             // Декларация УСН — ежегодно до 25 марта
  FSS4 = 'fss4',             // 4-ФСС (ЕФС-1) — ежеквартально
  UV_VZNOSY = 'uv_vznosy',   // Уведомление о страховых взносах — ежемесячно
  UUSN = 'uusn',             // Уведомление УСН — ежеквартально
  UV_NDFL = 'uv_ndfl',       // Уведомление по НДФЛ — дважды в месяц
}

export enum ReportPeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  /**
   * Дважды в месяц — периодичность одного только НДФЛ. Налог, удержанный с 1
   * по 22 число, перечисляется до 28 числа того же месяца, а удержанный с 23
   * по последнее число — до 5 числа следующего; на каждый срок своё
   * уведомление. Отсюда же шесть сроков в разделе 1 формы 6-НДФЛ.
   */
  SEMI_MONTHLY = 'semi_monthly',
}

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  VALIDATED = 'validated',
  ERROR = 'error',
}

export const REPORT_CONFIG: Record<ReportType, {
  name: string;
  period: ReportPeriodType;
  xsdFile: string;
  deadlineDescription: string;
}> = {
  [ReportType.BUHOTCH]: {
    name: t('reports.reportType.buhotchName'),
    period: ReportPeriodType.YEARLY,
    // Форма НКО v5.04 (КНД 0710096). XSD от ФНС (формат ЕД-7-1/1041 от 26.12.2024).
    xsdFile: 'NO_BOUPR_1_159_00_05_04_01.xsd',
    deadlineDescription: t('reports.reportType.buhotchDeadline'),
  },
  [ReportType.NDFL6]: {
    name: t('reports.reportType.ndfl6Name'),
    period: ReportPeriodType.QUARTERLY,
    xsdFile: 'NO_NDFL6.2_1_231_00_05_05_02.xsd',
    deadlineDescription: t('reports.reportType.ndfl6Deadline'),
  },
  [ReportType.RSV]: {
    name: t('reports.reportType.rsvName'),
    period: ReportPeriodType.QUARTERLY,
    xsdFile: 'NO_RASCHSV_1_162_00_05_08_02.xsd',
    deadlineDescription: t('reports.reportType.rsvDeadline'),
  },
  [ReportType.PSV]: {
    name: t('reports.reportType.psvName'),
    period: ReportPeriodType.MONTHLY,
    xsdFile: 'NO_PERSSVFL_1_297_00_05_01_02.xsd',
    deadlineDescription:
      t('reports.reportType.psvDeadline'),
  },
  [ReportType.DUSN]: {
    name: t('reports.reportType.dusnName'),
    period: ReportPeriodType.YEARLY,
    xsdFile: 'NO_USN_1_030_00_05_09_01.xsd',
    deadlineDescription: t('reports.reportType.dusnDeadline'),
  },
  [ReportType.FSS4]: {
    name: t('reports.reportType.fss4Name'),
    period: ReportPeriodType.QUARTERLY,
    // XSD 2024-01-01 со страницы СФР, пропатченная под формат 2026-01-01
    // (см. schemas/efs1/README.md).
    xsdFile: 'efs1/efs1.xsd',
    deadlineDescription: t('reports.reportType.fss4Deadline'),
  },
  [ReportType.UV_VZNOSY]: {
    name: t('reports.reportType.uvVznosyName'),
    period: ReportPeriodType.MONTHLY,
    xsdFile: 'UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd',
    deadlineDescription: t('reports.reportType.uvVznosyDeadline'),
  },
  [ReportType.UUSN]: {
    name: t('reports.reportType.uusnName'),
    period: ReportPeriodType.QUARTERLY,
    xsdFile: 'UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd',
    deadlineDescription: t('reports.reportType.uusnDeadline'),
  },
  [ReportType.UV_NDFL]: {
    name: t('reports.reportType.uvNdflName'),
    period: ReportPeriodType.SEMI_MONTHLY,
    xsdFile: 'UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd',
    deadlineDescription:
      t('reports.reportType.uvNdflDeadline') +
      t('reports.reportType.uvNdflDeadlineTail'),
  },
};

/**
 * Периоды уведомления по НДФЛ нумеруются сквозняком по году: на каждый месяц
 * приходится два периода, и у каждого свой черновик и свой поданный документ.
 * Номер месяца хранить недостаточно — два уведомления за один месяц иначе
 * перетирали бы друг друга.
 */
export const UV_NDFL_PERIODS_PER_YEAR = 24;

/** Разложить сквозной номер периода 1..24 в месяц и половину месяца. */
export function splitUvNdflPeriod(period: number): { month: number; secondHalf: boolean } {
  const month = Math.floor((period - 1) / 2) + 1;
  const secondHalf = period % 2 === 0;
  return { month, secondHalf };
}

/** Собрать сквозной номер периода из месяца и половины месяца. */
export function uvNdflPeriodOf(month: number, secondHalf: boolean): number {
  return (month - 1) * 2 + (secondHalf ? 2 : 1);
}
