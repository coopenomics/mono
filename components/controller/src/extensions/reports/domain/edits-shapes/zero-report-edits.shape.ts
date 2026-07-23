/**
 * Общий shape для «нулёвок» — форм, где все балансовые суммы = 0, и
 * редактируемы только реквизиты и подписант. Используется для NDFL6, RSV,
 * PSV, DUSN, UUSN (+UV_VZNOSY), FSS4/ЕФС-1.
 *
 * Каждый генератор берёт этот shape и специализируется под свою форму
 * (задаёт КНД, ВерсФорм, ПоМесту, КБК, period-код и пр. как константы).
 */

export type ZeroReportSignerType = 'chairman' | 'representative';

export interface ZeroReportHeaderShape {
  /** `<Файл ИдФайл="...">` — имя файла без расширения. Обычно autogen. */
  idFile: string;
  /** `<Файл ВерсПрог="...">`. */
  versProgram: string;
  /** `<Документ ДатаДок="DD.MM.YYYY">`. */
  docDate: string;
  /** `<Документ ОтчетГод="...">`. Для ЕФС-1 — `<Период Год>`. */
  reportYear: number;
  /** Квартал 1..4 (NDFL6/RSV/UUSN/FSS4) или месяц 1..12 (PSV). null для годовых (DUSN). */
  period: number | null;
  /** `<Документ НомКорр="...">` — 0..999. */
  correctionNumber: number;
}

export interface ZeroReportOrganizationShape {
  orgName: string;
  inn: string;
  kpp: string;
  /** ОКТМО — обязателен для NDFL6/DUSN/UUSN (в СвНП). */
  oktmo: string | null;
  /** ОКВЭД — для ЕФС-1 (УТ8:КодПоОКВЭД). */
  okved: string | null;
  okfs: string | null;
  okopf: string | null;
  okpo: string | null;
  /** ОГРН — для ЕФС-1 (ЕФС8:ОГРН). */
  ogrn: string | null;
  address: string | null;
}

export interface ZeroReportSignerShape {
  type: ZeroReportSignerType;
  lastName: string;
  firstName: string;
  middleName: string | null;
  /** Документ полномочий — для type=representative. */
  repDoc: string | null;
  /** СНИЛС — обязателен для ПСВ (ПерсСвФЛ @СНИЛС). */
  snils: string | null;
  /** Регистрационный номер в СФР — обязателен для ЕФС-1. */
  sfrRegNumber: string | null;
  /**
   * Регистрационный номер в ПФР (XXX-XXX-XXXXXX) — обязателен для ЕФС-1,
   * попадает и в <ЕФС8:РегНомер>, и в имя файла. Отдельное поле от
   * sfrRegNumber: сторонние бухгалтерские системы (СБИС и др.) при приёме
   * ЕФС-1 сверяют номер отправителя именно с рег. номером ПФР организации,
   * не с 10-значным номером СФР.
   */
  pfrRegNumber: string | null;
  /** Должность председателя — для ЕФС-1 (<УТ8:Должность>). */
  chairmanPosition: string | null;
}

export interface ZeroReportEditsShape {
  header: ZeroReportHeaderShape;
  organization: ZeroReportOrganizationShape;
  signer: ZeroReportSignerShape;
}
