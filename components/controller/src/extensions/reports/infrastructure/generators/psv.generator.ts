import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addFio, addSigner, getMonthPeriodCode, getTaxOfficeCode } from './xml-utils';

/**
 * Генератор ПСВ — Персонифицированные сведения (нулевой)
 * XSD: NO_PERSSVFL_1_297_00_05_01_02.xsd
 * КНД: 1151162
 *
 * Структура: Файл → Документ → [СвНП, Подписант, ПерсСвФЛ[]]
 * ПерсСвФЛ обязателен (minOccurs=1), содержит ФИО, @СНИЛС, @СумВыпл
 * Для нулевого отчёта: одна запись председателя с СумВыпл=0
 */
export class PsvGenerator implements IReportGenerator {
  readonly reportType = ReportType.PSV;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации ПСВ: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `NO_PERSSVFL_${input.inn}_${input.kpp}_${dateStr}_${generateUuid()}`;
  }

  private buildXml(input: ReportInput): string {
    const periodCode = getMonthPeriodCode(input.period);
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'CoopReports 1.0')
        .att('ВерсФорм', '5.01');

    const dokument = doc.ele('Документ')
      .att('КНД', '1151162')
      .att('ДатаДок', formatDate(new Date()))
      .att('НомКорр', '0')
      .att('Период', periodCode)
      .att('ОтчетГод', String(input.year))
      .att('КодНО', kodNO)
      .att('ПоМесту', '214');

    dokument.ele('СвНП')
      .ele('НПЮЛ')
        .att('НаимОрг', input.orgName)
        .att('ИННЮЛ', input.inn)
        .att('КПП', input.kpp)
      .up()
    .up();

    addSigner(dokument, input.signerFio);

    const persSv = dokument.ele('ПерсСвФЛ')
      .att('СНИЛС', input.signerSnils || '000-000-000 00')
      .att('СумВыпл', '0');

    addFio(persSv, input.signerFio);
    persSv.up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
