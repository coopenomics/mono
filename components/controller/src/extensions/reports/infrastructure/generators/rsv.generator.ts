import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import {
  addFlexibleSigner,
  createXmlDoc,
  formatDate,
  generateFnsFileName,
  getQuarterPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';

/**
 * РСВ — Расчёт по страховым взносам (нулевой).
 *
 * Форма: КНД 1151111, ВерсФорм 5.08. Эталон —
 * `reports-standarts/ВОСХОД/NO_RASCHSV_*_20260409_*.xml`.
 *
 * В нулевом отчёте <РасчетСВ/> — **пустой self-closing**, т.е. не содержит
 * ни одного подэлемента. Подписант — с <СвПред НаимДок="..." НаимОрг="...">.
 */
export class RsvGenerator implements IReportGenerator {
  readonly reportType = ReportType.RSV;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];
    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации РСВ: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    return generateFnsFileName('NO_RASCHSV', input);
  }

  private buildXml(input: ReportInput): string {
    const periodCode = getQuarterPeriodCode(input.period);
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ВерсПрог', 'Платформа отчётности кооператива 1.0')
        .att('ВерсФорм', '5.08')
        .att('ИдФайл', idFile);

    const dokument = doc.ele('Документ')
      .att('КНД', '1151111')
      .att('ДатаДок', formatDate(new Date()))
      .att('НомКорр', String(input.correctionNumber ?? 0))
      .att('Период', periodCode)
      .att('ОтчетГод', String(input.year))
      .att('КодНО', kodNO)
      .att('ПоМесту', '214');

    const svnp = dokument.ele('СвНП');
    svnp.ele('НПЮЛ')
      .att('НаимОрг', input.orgName)
      .att('ИННЮЛ', input.inn)
      .att('КПП', input.kpp)
      .up();
    svnp.up();

    // РСВ у представителя требует НаимОрг в <СвПред>.
    addFlexibleSigner(dokument, input, { svPredNaimOrg: true });

    dokument.ele('РасчетСВ').up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
