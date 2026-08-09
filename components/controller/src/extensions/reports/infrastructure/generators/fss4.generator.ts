import { randomUUID } from 'crypto';
import { create } from 'xmlbuilder2';
import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';

/**
 * ЕФС-1 (ex-4ФСС) — отчёт в СФР, нулевой вариант.
 * Eфс-1 принципиально отличается от ФНС-форм (UTF-8, ns'ы, <ЭДСФР>,
 * <Руководитель> вместо <Подписант>). Коды <Период>/<Код> по XSD —
 * номер месяца окончания квартала (03 | 06 | 09 | 12):
 *   Q1 → "03", Q2 → "06", Q3 → "09", Q4 → "12".
 */
const EFS_NS = {
  default: 'http://пф.рф/ЕФС-1/2026-01-01',
  АФ8: 'http://пф.рф/АФ/2025-01-01',
  УТ8: 'http://пф.рф/УТ/2025-01-01',
  ВС8: 'http://пф.рф/ВС/типы/2025-01-01',
  ЕФС8: 'http://пф.рф/ВС/ЕФС/2026-01-01',
  ns1: 'http://www.w3.org/2000/09/xmldsig#',
  sig: 'http://iis.ecp.ru/SignInfo/2023-01-10',
};

const ZERO = '0.00';
const ZERO_INT = '0';

function sfrPeriodCode(quarter: number | null): string {
  switch (quarter) {
    case 1: return '03';
    case 2: return '06';
    case 3: return '09';
    case 4: return '12';
    default: return '03';
  }
}

function sfrDateTime(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const MSK_OFFSET_MIN = 3 * 60;
  const mskTime = new Date(now.getTime() + MSK_OFFSET_MIN * 60_000 + now.getTimezoneOffset() * 60_000);
  return `${mskTime.getUTCFullYear()}-${pad(mskTime.getUTCMonth() + 1)}-${pad(mskTime.getUTCDate())}T${pad(mskTime.getUTCHours())}:${pad(mskTime.getUTCMinutes())}:${pad(mskTime.getUTCSeconds())}+03:00`;
}

// xmlbuilder2 `ele()` возвращает XMLBuilder, но строгий тип экспортируется
// как generic-интерфейс, который сложно заимпортить без раздутия импортов.
// В пределах этого файла используем узкий псевдоним.
type XmlBuilder = ReturnType<ReturnType<typeof create>['ele']>;

function addMonthlyZeroTuple(parent: XmlBuilder, name: string): void {
  const el = parent.ele(name);
  el.ele('ЕФС8:ВсегоСНачала').txt(ZERO).up();
  el.ele('ЕФС8:НаКонец').txt(ZERO).up();
  el.ele('ЕФС8:ПервыйМесяц').txt(ZERO).up();
  el.ele('ЕФС8:ВторойМесяц').txt(ZERO).up();
  el.ele('ЕФС8:ТретийМесяц').txt(ZERO).up();
  el.up();
}

export class Fss4Generator implements IReportGenerator {
  readonly reportType = ReportType.FSS4;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    if (!edits.signer.pfrRegNumber) {
      // В документ идёт только pfrRegNumber (см. strah.ele('ЕФС8:РегНомер')
      // ниже) — sfrRegNumber в ЕФС-1 не используется вовсе, поэтому не
      // проверяем его здесь, хотя в реквизитах кооператива оно и остаётся
      // обязательным полем (может понадобиться другим формам/интеграциям).
      errors.push('Для ЕФС-1 обязателен рег. номер страхователя в ПФР (поле signer.pfrRegNumber)');
    }
    if (errors.length) {
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации ЕФС-1: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const now = new Date();
    const guid = randomUUID();
    const periodCode = sfrPeriodCode(header.period);
    const corrNum = String(header.correctionNumber).padStart(3, '0');

    const doc = create({ version: '1.0', encoding: 'utf-8' });
    const edsfr = doc.ele('ЭДСФР', {
      xmlns: EFS_NS.default,
      'xmlns:АФ8': EFS_NS.АФ8,
      'xmlns:УТ8': EFS_NS.УТ8,
      'xmlns:ВС8': EFS_NS.ВС8,
      'xmlns:ЕФС8': EFS_NS.ЕФС8,
      'xmlns:ns1': EFS_NS.ns1,
      'xmlns:sig': EFS_NS.sig,
    });

    const efs1 = edsfr.ele('ЕФС-1');

    const strah = efs1.ele('Страхователь');
    // Тег «Действующий регистрационный номер страхователя» (см. XSD
    // efs-types.xsd/ТипСтрахователь) — сюда идёт номер ПФР, а не СФР:
    // сторонние бухгалтерские системы (СБИС и др.) при приёме ЕФС-1 сверяют
    // рег. номер отправителя в имени файла и в этом теге со своим профилем
    // организации, где обычно заведён именно старый номер ПФР (XXX-XXX-XXXXXX).
    // pfrRegNumber гарантированно определён — guard в generate() выше.
    strah.ele('ЕФС8:РегНомер').txt(signer.pfrRegNumber ?? '').up();
    strah.ele('ЕФС8:Наименование').txt(organization.orgName).up();
    strah.ele('УТ8:ИНН').txt(organization.inn).up();
    strah.ele('УТ8:КПП').txt(organization.kpp).up();
    if (organization.okved) strah.ele('УТ8:КодПоОКВЭД').txt(organization.okved).up();
    if (organization.ogrn) strah.ele('ЕФС8:ОГРН').txt(organization.ogrn).up();
    strah.up();

    const oss = efs1.ele('ОСС');
    oss.ele('НомерКорректировки').txt(corrNum).up();
    const per = oss.ele('Период');
    per.ele('Код').txt(periodCode).up();
    per.ele('Год').txt(String(header.reportYear)).up();
    per.up();

    const chisl = oss.ele('Численность');
    chisl.ele('Среднесписочная').txt(ZERO_INT).up();
    chisl.ele('РабПоОбСоцСтрах').txt(ZERO_INT).up();
    chisl.up();

    const rssv = oss.ele('РССВ');
    addMonthlyZeroTuple(rssv, 'СуммаВыплИн');
    addMonthlyZeroTuple(rssv, 'БазаИсч');
    rssv.ele('СтраховойТариф').txt('0.20').up();
    rssv.ele('СкидкаТариф').txt('0.00').up();
    rssv.ele('НадбавкаТариф').txt('0.00').up();
    rssv.ele('ТарифУчСкидНадб').txt('0.200').up();
    addMonthlyZeroTuple(rssv, 'ИсчислСтрахВзн');
    rssv.up();

    const rpo = oss.ele('РПО');
    rpo.ele('ОбщЧисл').txt(ZERO_INT).up();
    rpo.ele('ПрошЧисл').txt(ZERO_INT).up();
    const rez = rpo.ele('Результат');
    rez.ele('КоличРабМест').txt(ZERO_INT).up();
    const ocenki = rez.ele('Оценки');
    ocenki.ele('Всего').txt(ZERO_INT).up();
    const klassy = ocenki.ele('Классы');
    klassy.ele('Класс1').txt(ZERO_INT).up();
    klassy.ele('Класс2').txt(ZERO_INT).up();
    const klass3 = klassy.ele('Класс3');
    klass3.ele('Подкласс3.1').txt(ZERO_INT).up();
    klass3.ele('Подкласс3.2').txt(ZERO_INT).up();
    klass3.ele('Подкласс3.3').txt(ZERO_INT).up();
    klass3.ele('Подкласс3.4').txt(ZERO_INT).up();
    klass3.up();
    klassy.ele('Класс4').txt(ZERO_INT).up();
    klassy.up();
    ocenki.up();
    rez.up();
    rpo.up();
    oss.up();

    const ruk = efs1.ele('Руководитель');
    const fio = ruk.ele('УТ8:ФИО');
    fio.ele('УТ8:Фамилия').txt(signer.lastName).up();
    fio.ele('УТ8:Имя').txt(signer.firstName).up();
    if (signer.middleName) fio.ele('УТ8:Отчество').txt(signer.middleName).up();
    fio.up();
    ruk.ele('УТ8:Должность').txt(signer.chairmanPosition ?? 'Председатель Совета').up();
    ruk.up();

    const dPad = (n: number) => String(n).padStart(2, '0');
    const fillDate = `${now.getFullYear()}-${dPad(now.getMonth() + 1)}-${dPad(now.getDate())}`;
    efs1.ele('ДатаЗаполнения').txt(fillDate).up();
    efs1.up();

    const sluzh = edsfr.ele('СлужебнаяИнформация');
    sluzh.ele('АФ8:GUID').txt(guid).up();
    sluzh.ele('АФ8:ДатаВремя').txt(sfrDateTime(now)).up();
    sluzh.ele('АФ8:ПрограммаПодготовки').txt(header.versProgram).up();
    sluzh.up();

    edsfr.up();

    return doc.end({ prettyPrint: false });
  }
}
