import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';
import {
  addFlexibleSignerFromShape,
  addHeaderMeta,
  createXmlDoc,
  getQuarterPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';

/**
 * РСВ — Расчёт по страховым взносам (нулевой).
 *
 * Форма: КНД 1151111, ВерсФорм 5.08. Эталон —
 * `reports-standarts/ВОСХОД/NO_RASCHSV_*_20260409_*.xml`.
 *
 * В нулевом отчёте <РасчетСВ/> — пустой self-closing.
 * Подписант — с <СвПред НаимДок="..." НаимОрг="..."> (опция svPredNaimOrg).
 */
export class RsvGenerator implements IReportGenerator {
  readonly reportType = ReportType.RSV;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации РСВ: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const periodCode = getQuarterPeriodCode(header.period ?? undefined);
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ВерсПрог', header.versProgram)
        .att('ВерсФорм', '5.08')
        .att('ИдФайл', header.idFile);

    const dokument = doc.ele('Документ').att('КНД', '1151111');
    addHeaderMeta(dokument, {
      docDate: header.docDate,
      period: periodCode,
      year: header.reportYear,
      kodNO,
      correctionNumber: header.correctionNumber,
      poMestu: '214',
    });

    const svnp = dokument.ele('СвНП');
    svnp.ele('НПЮЛ')
      .att('НаимОрг', organization.orgName)
      .att('ИННЮЛ', organization.inn)
      .att('КПП', organization.kpp)
      .up();
    svnp.up();

    addFlexibleSignerFromShape(dokument, signer, {
      svPredNaimOrg: true,
      orgName: organization.orgName,
    });

    dokument.ele('РасчетСВ').up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
