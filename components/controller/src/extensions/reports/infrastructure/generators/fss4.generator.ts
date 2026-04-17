import { randomUUID } from 'crypto';
import { create } from 'xmlbuilder2';
import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';

/**
 * ЕФС-1 (заменил 4-ФСС с 2023 г.) — отчёт в СФР, нулевой вариант.
 *
 * Эталон: `reports-standarts/ВОСХОД/СФР_<рег>_ЕФС-1_*.xml`.
 *
 * Формат принципиально другой, чем у ФНС-форм:
 *   - кодировка UTF-8 (не windows-1251);
 *   - корневой `<ЭДСФР>` с множеством namespace'ов (АФ8, УТ8, ВС8, ЕФС8 + ns1/sig);
 *   - нет привычных <Файл>/<Документ>, подписант другой (<Руководитель>);
 *   - регистрационный номер страхователя СФР (не ИНН/КПП/ОГРН) — вводится отдельно.
 *
 * Квартальные коды СФР отличаются от ФНС:
 *   1 квартал → "03", 2 → "06", 3 → "09", год (IV) → "0".
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

function sfrPeriodCode(quarter?: number): string {
  switch (quarter) {
    case 1: return '03';
    case 2: return '06';
    case 3: return '09';
    case 4: return '0';
    default: return '03';
  }
}

function sfrDateTime(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // +03:00 для Москвы; в dev окружении важнее структура, чем точный offset.
  const tzOffsetMin = -now.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const tz = `${sign}${pad(Math.floor(Math.abs(tzOffsetMin) / 60))}:${pad(Math.abs(tzOffsetMin) % 60)}`;
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${tz}`;
}

function addMonthlyZeroTuple(parent: any, name: string): void {
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

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];
    if (!input.sfrRegNumber) {
      errors.push('Для ЕФС-1 обязательно поле sfrRegNumber (регистрационный номер страхователя в СФР)');
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации ЕФС-1: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const reg = input.sfrRegNumber ?? '0000000000';
    return `СФР_${reg}_ЕФС-1_${dateStr}_${randomUUID()}`;
  }

  private buildXml(input: ReportInput): string {
    const now = new Date();
    const guid = randomUUID();
    const periodCode = sfrPeriodCode(input.period);
    const corrNum = String(input.correctionNumber ?? 0).padStart(3, '0');

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
    strah.ele('ЕФС8:РегНомер').txt(input.sfrRegNumber!).up();
    strah.ele('ЕФС8:Наименование').txt(input.orgName).up();
    strah.ele('УТ8:ИНН').txt(input.inn).up();
    strah.ele('УТ8:КПП').txt(input.kpp).up();
    if (input.okved) strah.ele('УТ8:КодПоОКВЭД').txt(input.okved).up();
    if (input.ogrn) strah.ele('ЕФС8:ОГРН').txt(input.ogrn).up();
    strah.up();

    const oss = efs1.ele('ОСС');
    oss.ele('НомерКорректировки').txt(corrNum).up();
    const per = oss.ele('Период');
    per.ele('Код').txt(periodCode).up();
    per.ele('Год').txt(String(input.year)).up();
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
    fio.ele('УТ8:Фамилия').txt(input.signerFio.lastName).up();
    fio.ele('УТ8:Имя').txt(input.signerFio.firstName).up();
    if (input.signerFio.middleName) fio.ele('УТ8:Отчество').txt(input.signerFio.middleName).up();
    fio.up();
    ruk.ele('УТ8:Должность').txt(input.chairmanPosition ?? 'Председатель Совета').up();
    ruk.up();

    // ДатаЗаполнения: xs:date + pattern \d{4}-\d{2}-\d{2} по XSD ЕФС-1.
    // Эталон КОНТУР-ЭКСТЕРН оставляет её пустой, но тогда XSD-валидация падает.
    const dPad = (n: number) => String(n).padStart(2, '0');
    const fillDate = `${now.getFullYear()}-${dPad(now.getMonth() + 1)}-${dPad(now.getDate())}`;
    efs1.ele('ДатаЗаполнения').txt(fillDate).up();
    efs1.up();

    const sluzh = edsfr.ele('СлужебнаяИнформация');
    sluzh.ele('АФ8:GUID').txt(guid).up();
    sluzh.ele('АФ8:ДатаВремя').txt(sfrDateTime(now)).up();
    sluzh.ele('АФ8:ПрограммаПодготовки').txt('Платформа отчётности кооператива 1.0').up();
    sluzh.up();

    edsfr.up();

    return doc.end({ prettyPrint: false });
  }
}
