import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addSigner, getQuarterPeriodCode, getTaxOfficeCode } from './xml-utils';

/**
 * Генератор 4-ФСС (ЕФС-1) — нулевой
 * XSD не предоставлен, формат приближённый к стандарту СФР
 * КНД: 1111111 (условный)
 *
 * С 2023 года 4-ФСС заменён на ЕФС-1 (подраздел 2.1)
 * Подаётся в Социальный фонд России ежеквартально
 */
export class Fss4Generator implements IReportGenerator {
  readonly reportType = ReportType.FSS4;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации 4-ФСС: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `EFS1_${input.inn}_${input.kpp}_${dateStr}_${generateUuid()}`;
  }

  private buildXml(input: ReportInput): string {
    const periodCode = getQuarterPeriodCode(input.period);
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'CoopReports 1.0')
        .att('ВерсФорм', '1.00');

    const dokument = doc.ele('Документ')
      .att('КНД', '1111111')
      .att('ДатаДок', formatDate(new Date()))
      .att('Период', periodCode)
      .att('ОтчетГод', String(input.year))
      .att('КодНО', kodNO)
      .att('НомКорр', '0')
      .att('ПоМесту', '214');

    dokument.ele('СвНП')
      .ele('НПЮЛ')
        .att('НаимОрг', input.orgName)
        .att('ИННЮЛ', input.inn)
        .att('КПП', input.kpp)
      .up()
    .up();

    addSigner(dokument, input.signerFio);

    dokument.ele('ЕФС1')
      .att('СрЧисл', '1')
      .att('СумНачислВзнос', '0')
      .att('СумУплВзнос', '0')
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
