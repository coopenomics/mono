export enum ReportType {
  BUHOTCH = 'buhotch',       // Бухгалтерский баланс — ежегодно до 31 марта
  NDFL6 = 'ndfl6',           // 6-НДФЛ — ежеквартально до 25 числа следующего месяца
  RSV = 'rsv',               // РСВ — ежеквартально до 25 числа следующего месяца  
  PSV = 'psv',               // ПСВ — ежемесячно до 25 числа следующего месяца
  DUSN = 'dusn',             // Декларация УСН — ежегодно до 25 марта
  FSS4 = 'fss4',             // 4-ФСС (ЕФС-1) — ежеквартально
  UV_VZNOSY = 'uv_vznosy',   // Уведомление о страховых взносах — ежемесячно
  UUSN = 'uusn',             // Уведомление УСН — ежеквартально
}

export enum ReportPeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
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
    name: 'Бухгалтерский баланс',
    period: ReportPeriodType.YEARLY,
    // Форма НКО v5.04 (КНД 0710096) — XSD из ФНС пока не добыта в репо
    // (в schemas/ лежит только v5.09 КНД 0710099 коммерческой формы). До появления
    // корректной XSD валидация BUHOTCH пропускается; структура сверяется с эталоном
    // reports-standarts/ВОСХОД/NO_BOUPR_*.xml.
    xsdFile: '',
    deadlineDescription: 'До 31 марта следующего года',
  },
  [ReportType.NDFL6]: {
    name: '6-НДФЛ',
    period: ReportPeriodType.QUARTERLY,
    xsdFile: 'NO_NDFL6.2_1_231_00_05_05_02.xsd',
    deadlineDescription: 'До 25 числа следующего за кварталом месяца',
  },
  [ReportType.RSV]: {
    name: 'Расчёт по страховым взносам (РСВ)',
    period: ReportPeriodType.QUARTERLY,
    xsdFile: 'NO_RASCHSV_1_162_00_05_08_02.xsd',
    deadlineDescription: 'До 25 числа следующего за кварталом месяца',
  },
  [ReportType.PSV]: {
    name: 'Персонифицированные сведения (ПСВ)',
    period: ReportPeriodType.MONTHLY,
    xsdFile: 'NO_PERSSVFL_1_297_00_05_01_02.xsd',
    deadlineDescription: 'До 25 числа следующего месяца',
  },
  [ReportType.DUSN]: {
    name: 'Декларация по УСН',
    period: ReportPeriodType.YEARLY,
    xsdFile: 'NO_USN_1_030_00_05_09_01.xsd',
    deadlineDescription: 'До 25 марта следующего года',
  },
  [ReportType.FSS4]: {
    name: '4-ФСС (ЕФС-1)',
    period: ReportPeriodType.QUARTERLY,
    xsdFile: '',
    deadlineDescription: 'До 25 числа следующего за кварталом месяца',
  },
  [ReportType.UV_VZNOSY]: {
    name: 'Уведомление об исчисленных страховых взносах',
    period: ReportPeriodType.MONTHLY,
    xsdFile: 'UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd',
    deadlineDescription: 'До 25 числа текущего месяца',
  },
  [ReportType.UUSN]: {
    name: 'Уведомление по УСН',
    period: ReportPeriodType.QUARTERLY,
    xsdFile: 'UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd',
    deadlineDescription: 'До 25 числа следующего за кварталом месяца',
  },
};
