import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addSigner, getQuarterPeriodCode, getTaxOfficeCode } from './xml-utils';

/**
 * Генератор 6-НДФЛ — нулевая отчётность
 * XSD: NO_NDFL6.2_1_231_00_05_05_02.xsd
 * КНД: 1151100
 *
 * Структура:
 *   Файл → Документ → [СвНП, Подписант, НДФЛ6.2]
 *   СвНП содержит @ОКТМО и выбор НПЮЛ/НПФЛ
 *   НДФЛ6.2 содержит ОбязНА[], РасчСумНал[], СправДох[]
 *   Для нулевого отчёта: РасчСумНал со ставкой 13% и нулями
 */
export class Ndfl6Generator implements IReportGenerator {
  readonly reportType = ReportType.NDFL6;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации 6-НДФЛ: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const uuid = generateUuid();
    return `NO_NDFL6.2_${input.inn}_${input.kpp}_${dateStr}_${uuid}`;
  }

  private buildXml(input: ReportInput): string {
    const periodCode = getQuarterPeriodCode(input.period);
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'CoopReports 1.0')
        .att('ВерсФорм', '5.05');

    const dokument = doc.ele('Документ')
      .att('КНД', '1151100')
      .att('ДатаДок', formatDate(new Date()))
      .att('Период', periodCode)
      .att('ОтчетГод', String(input.year))
      .att('КодНО', kodNO)
      .att('НомКорр', '0')
      .att('ПоМесту', '214');

    dokument.ele('СвНП')
      .att('ОКТМО', input.oktmo)
      .ele('НПЮЛ')
        .att('НаимОрг', input.orgName)
        .att('ИННЮЛ', input.inn)
        .att('КПП', input.kpp)
      .up()
    .up();

    addSigner(dokument, input.signerFio);

    const ndfl = dokument.ele('НДФЛ6.2');

    ndfl.ele('РасчСумНал')
      .att('Ставка', '13')
      .att('КБК', '18210102010011000110')
      .att('КолФЛ', '0')
      .att('КолКвал', '0')
      .att('СумНачислНач', '0')
      .att('СумНачислКвал', '0')
      .att('СумВыч', '0')
      .att('НалБаза', '0')
      .att('СумНалИсч', '0')
      .att('СумНалИсчКвал', '0')
      .att('СумФикс', '0')
      .att('СумНалПриб', '0')
      .att('СумНалИнГос', '0')
      .att('СумНалУдерж', '0')
      .att('СумНалУдерж1Мес', '0')
      .att('СумНалУдерж23_1Мес', '0')
      .att('СумНалУдерж2Мес', '0')
      .att('СумНалУдерж23_2Мес', '0')
      .att('СумНалУдерж3Мес', '0')
      .att('СумНалУдерж23_3Мес', '0')
      .att('СумНалНеУдерж', '0')
      .att('СумНалИзлУдерж', '0')
      .att('СумНалВозвр', '0')
      .att('СумНалВозвр1Мес', '0')
      .att('СумНалВозвр23_1Мес', '0')
      .att('СумНалВозвр2Мес', '0')
      .att('СумНалВозвр23_2Мес', '0')
      .att('СумНалВозвр3Мес', '0')
      .att('СумНалВозвр23_3Мес', '0')
    .up();

    ndfl.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
