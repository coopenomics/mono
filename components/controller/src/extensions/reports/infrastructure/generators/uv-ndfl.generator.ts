import { ReportType, UV_NDFL_PERIODS_PER_YEAR, splitUvNdflPeriod } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { UvNdflEditsShape } from '../../domain/edits-shapes/uv-ndfl-edits.shape';
import { getNdflParams } from '../../domain/services/ndfl-reference';
import { createXmlDoc, formatDate, getTaxOfficeCode } from './xml-utils';

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
        `Ошибка генерации уведомления по НДФЛ: ${e instanceof Error ? e.message : String(e)}`,
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
        `uv-ndfl: период должен быть целым от 1 до ${UV_NDFL_PERIODS_PER_YEAR} ` +
          `(получено: ${header.period})`,
      );
    }
    const { month, secondHalf } = splitUvNdflPeriod(period);
    const quarter = Math.ceil(month / 3);
    const quarterCode: Record<number, string> = { 1: '21', 2: '31', 3: '33', 4: '34' };
    const monthInQuarter = ((month - 1) % 3) + 1;
    // 01/02/03 — первый расчётный период месяца, 11/12/13 — второй.
    const monthCode = String((secondHalf ? 10 : 0) + monthInQuarter).padStart(2, '0');

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', header.idFile)
        .att('ВерсПрог', header.versProgram)
        .att('ВерсФорм', '5.03');

    const dokument = doc.ele('Документ')
      .att('КНД', '1110355')
      .att('ДатаДок', header.docDate ?? formatDate(new Date()))
      .att('КодНО', kodNO);

    dokument.ele('СвНП')
      .ele('НПЮЛ')
        .att('ИННЮЛ', organization.inn)
        .att('КПП', organization.kpp)
      .up()
    .up();

    const sig = dokument.ele('Подписант').att('ПрПодп', '1');
    const fio = sig.ele('ФИО')
      .att('Фамилия', signer.lastName)
      .att('Имя', signer.firstName);
    if (signer.middleName) fio.att('Отчество', signer.middleName);
    fio.up();
    sig.up();

    dokument.ele('УвИсчСумНалог')
      .att('КППДекл', organization.kpp)
      .att('ОКТМО', organization.oktmo ?? '')
      .att('КБК', getNdflParams(header.reportYear).kbk)
      .att('СумНалогАванс', String(Math.round(edits.payment?.amount ?? 0)))
      .att('Период', quarterCode[quarter])
      .att('НомерМесКварт', monthCode)
      .att('Год', String(header.reportYear))
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
