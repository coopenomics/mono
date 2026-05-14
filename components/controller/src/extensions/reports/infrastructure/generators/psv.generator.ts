import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';
import {
  addHeaderMeta,
  createXmlDoc,
  getMonthPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';

/**
 * ПСВ — Персонифицированные сведения (нулевой).
 * XSD: NO_PERSSVFL_1_297_00_05_01_02.xsd, КНД: 1151162, ВерсФорм 5.01.
 *
 * В нулевом отчёте — одна запись <ПерсСвФЛ> для подписанта (председателя)
 * с @СумВыпл=0. СНИЛС обязателен — берётся из signer.snils.
 */
export class PsvGenerator implements IReportGenerator {
  readonly reportType = ReportType.PSV;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации ПСВ: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const periodCode = getMonthPeriodCode(header.period ?? undefined);
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', header.idFile)
        .att('ВерсПрог', header.versProgram)
        .att('ВерсФорм', '5.01');

    const dokument = doc.ele('Документ').att('КНД', '1151162');
    addHeaderMeta(dokument, {
      docDate: header.docDate,
      period: periodCode,
      year: header.reportYear,
      kodNO,
      correctionNumber: header.correctionNumber,
      poMestu: '214',
    });

    dokument.ele('СвНП')
      .ele('НПЮЛ')
        .att('НаимОрг', organization.orgName)
        .att('ИННЮЛ', organization.inn)
        .att('КПП', organization.kpp)
      .up()
    .up();

    // ПСВ использует базовый <Подписант ПрПодп="1"> без <СвПред>, даже если
    // type=representative (это особенность формы — подписант персонифицированных
    // сведений по сути один и тот же ФИО как председатель).
    const sig = dokument.ele('Подписант').att('ПрПодп', '1');
    const fio = sig.ele('ФИО')
      .att('Фамилия', signer.lastName)
      .att('Имя', signer.firstName);
    if (signer.middleName) fio.att('Отчество', signer.middleName);
    fio.up();
    sig.up();

    const persSv = dokument.ele('ПерсСвФЛ')
      .att('СНИЛС', signer.snils || '000-000-000 00')
      .att('СумВыпл', '0');

    const persFio = persSv.ele('ФИО')
      .att('Фамилия', signer.lastName)
      .att('Имя', signer.firstName);
    if (signer.middleName) persFio.att('Отчество', signer.middleName);
    persFio.up();
    persSv.up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
