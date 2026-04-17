import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import {
  addFlexibleSigner,
  createXmlDoc,
  formatDate,
  generateFnsFileName,
  getTaxOfficeCode,
} from './xml-utils';

/**
 * ДУСН — Декларация по УСН (нулевая).
 *
 * Форма: КНД 1152017, ВерсФорм 5.09. Эталон —
 * `reports-standarts/ВОСХОД/NO_USN_*_20260409_*.xml`.
 *
 * Особенности:
 *   - ПоМесту="210" (по месту нахождения организации), не 120.
 *   - ОтчетГод = year - 1 (декларация за прошлый год, подаётся в марте текущего).
 *   - <УСН ОбНал="1">: РасчНал1 с ПризНП="1", ставка 0, все суммы 0.
 */
export class DusnGenerator implements IReportGenerator {
  readonly reportType = ReportType.DUSN;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];
    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации ДУСН: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    return generateFnsFileName('NO_USN', input);
  }

  private buildXml(input: ReportInput): string {
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);
    // Декларация УСН подаётся за прошедший год:
    // если input.year — текущий год подачи, ОтчетГод = year - 1.
    const reportYear = input.year - 1;

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ВерсПрог', 'Платформа отчётности кооператива 1.0')
        .att('ВерсФорм', '5.09')
        .att('ИдФайл', idFile);

    const dokument = doc.ele('Документ')
      .att('КНД', '1152017')
      .att('ДатаДок', formatDate(new Date()))
      .att('Период', '34')
      .att('ОтчетГод', String(reportYear))
      .att('КодНО', kodNO)
      .att('НомКорр', String(input.correctionNumber ?? 0))
      .att('ПоМесту', '210');

    const svnp = dokument.ele('СвНП');
    svnp.ele('НПЮЛ')
      .att('НаимОрг', input.orgName)
      .att('ИННЮЛ', input.inn)
      .att('КПП', input.kpp)
      .up();
    svnp.up();

    addFlexibleSigner(dokument, input);

    const usn = dokument.ele('УСН').att('ОбНал', '1');
    const section = usn.ele('СумНалПУ_НП')
      .att('ОКТМО', input.oktmo)
      .att('НалПУУменПер', '0');

    const rasch = section.ele('РасчНал1').att('ПризНП', '1');
    rasch.ele('Доход').att('СумЗаНалПер', '0').up();
    rasch.ele('Ставка').att('СтавкаНалПер', '0').up();
    rasch.ele('Исчисл').att('СумЗаНалПер', '0').up();
    rasch.ele('УменНал').att('СумЗаНалПер', '0').up();
    rasch.up();

    section.up();
    usn.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
