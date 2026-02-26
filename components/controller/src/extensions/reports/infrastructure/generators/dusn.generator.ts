import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addSigner, getTaxOfficeCode } from './xml-utils';

/**
 * Генератор ДУСН — Декларация по УСН (нулевая)
 * XSD: NO_USN_1_030_00_05_09_01.xsd
 * КНД: 1152017
 *
 * Структура: Файл → Документ → [СвНП, Подписант, УСН]
 * УСН содержит @ОбНал (1=доходы, 2=доходы-расходы)
 * Для кооператива: ОбНал=1 (доходы)
 * Раздел 1.1 — СумНалПУ_НП с нулями
 * Раздел 2.1.1 — РасчНал1 с нулями
 */
export class DusnGenerator implements IReportGenerator {
  readonly reportType = ReportType.DUSN;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации ДУСН: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `NO_USN_${input.inn}_${input.kpp}_${dateStr}_${generateUuid()}`;
  }

  private buildXml(input: ReportInput): string {
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'CoopReports 1.0')
        .att('ВерсФорм', '5.09');

    const dokument = doc.ele('Документ')
      .att('КНД', '1152017')
      .att('ДатаДок', formatDate(new Date()))
      .att('Период', '34')
      .att('ОтчетГод', String(input.year))
      .att('КодНО', kodNO)
      .att('НомКорр', '0')
      .att('ПоМесту', '120');

    dokument.ele('СвНП')
      .ele('НПЮЛ')
        .att('НаимОрг', input.orgName)
        .att('ИННЮЛ', input.inn)
        .att('КПП', input.kpp)
      .up()
    .up();

    addSigner(dokument, input.signerFio);

    const usn = dokument.ele('УСН').att('ОбНал', '1');

    const section1 = usn.ele('СумНалПУ_НП')
      .att('ОКТМО', input.oktmo)
      .att('НалПУУменПер', '0');

    section1.ele('РасчНал1')
      .att('ПризНП', '2')
      .ele('Доход')
        .att('СумЗаНалПер', '0')
      .up()
      .ele('Ставка')
        .att('СтавкаНалПер', '6.0')
      .up()
      .ele('Исчисл')
        .att('СумЗаНалПер', '0')
      .up()
      .ele('УменНал')
        .att('СумЗаНалПер', '0')
      .up()
    .up();

    section1.up();
    usn.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
