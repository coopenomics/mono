import { ReportType, UV_NDFL_PERIODS_PER_YEAR, splitUvNdflPeriod } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { UvNdflEditsShape } from '../../domain/edits-shapes/uv-ndfl-edits.shape';
import { getNdflParams } from '../../domain/services/ndfl-reference';
import { createXmlDoc, formatDate, getTaxOfficeCode } from './xml-utils';
import { t } from '../../i18n';

/**
 * Уведомление об исчисленных суммах НДФЛ. КНД 1110355, ВерсФорм 5.03 —
 * та же форма и XSD, что у уведомлений по УСН и страховым взносам.
 *
 * Период кодируется парой атрибутов. `Период` — квартал (21/31/33/34), а
 * `НомерМесКварт` — номер внутри квартала, и вот здесь у НДФЛ своя, отличная
 * от других налогов нумерация:
 *
 *   01, 02, 03 — налог, удержанный с 1 по 22 число первого, второго и
 *                третьего месяца квартала;
 *   11, 12, 13 — налог, удержанный с 23 по последнее число тех же месяцев.
 *
 * У остальных налогов коды 11/12/13 не применяются: там 01/02/03 означают
 * просто порядковый месяц квартала.
 */
export class UvNdflGenerator implements IReportGenerator {
  readonly reportType = ReportType.UV_NDFL;

  generate(input: unknown): ReportOutput {
    const edits = input as UvNdflEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(
        t('reports.uvNdfl.generationErrorMessage', { message: e instanceof Error ? e.message : String(e) }),
      );
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: UvNdflEditsShape): string {
    const { header, organization, signer } = edits;
    const kodNO = getTaxOfficeCode(organization.kpp);

    const period = header.period ?? 1;
    if (!Number.isInteger(period) || period < 1 || period > UV_NDFL_PERIODS_PER_YEAR) {
      throw new Error(
        t('reports.uvNdfl.periodInvalidPrefix', { periodsPerYear: UV_NDFL_PERIODS_PER_YEAR }) +
          t('reports.uvNdfl.periodInvalidSuffix', { period: header.period }),
      );
    }
    const { month, secondHalf } = splitUvNdflPeriod(period);
    const quarter = Math.ceil(month / 3);
    const quarterCode: Record<number, string> = { 1: '21', 2: '31', 3: '33', 4: '34' };
    const monthInQuarter = ((month - 1) % 3) + 1;
    // 01/02/03 — первый расчётный период месяца, 11/12/13 — второй.
    const monthCode = String((secondHalf ? 10 : 0) + monthInQuarter).padStart(2, '0');

    const doc = createXmlDoc()
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Файл')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИдФайл', header.idFile)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсПрог', header.versProgram)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсФорм', '5.03');

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const dokument = doc.ele('Документ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КНД', '1110355')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ДатаДок', header.docDate ?? formatDate(new Date()))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КодНО', kodNO);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    dokument.ele('СвНП')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('НПЮЛ')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИННЮЛ', organization.inn)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('КПП', organization.kpp)
      .up()
    .up();

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const sig = dokument.ele('Подписант').att('ПрПодп', '1');
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const fio = sig.ele('ФИО')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Фамилия', signer.lastName)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Имя', signer.firstName);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (signer.middleName) fio.att('Отчество', signer.middleName);
    fio.up();
    sig.up();

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    dokument.ele('УвИсчСумНалог')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КППДекл', organization.kpp)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ОКТМО', organization.oktmo ?? '')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КБК', getNdflParams(header.reportYear).kbk)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалогАванс', String(Math.round(edits.payment?.amount ?? 0)))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Период', quarterCode[quarter])
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НомерМесКварт', monthCode)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Год', String(header.reportYear))
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
