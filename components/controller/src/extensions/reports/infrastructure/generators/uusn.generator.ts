import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addSigner, getQuarterPeriodCode, getTaxOfficeCode } from './xml-utils';

/**
 * Генератор Уведомления по УСН (нулевое)
 * XSD: UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd (общий с UV_VZNOSY)
 * КНД: 1110355
 *
 * Уведомление об исчисленных суммах авансовых платежей по УСН
 * Подаётся ежеквартально до 25-го числа
 */
export class UusnGenerator implements IReportGenerator {
  readonly reportType = ReportType.UUSN;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации уведомления по УСН: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `UT_UVISCHSUMNAL_${input.inn}_${input.kpp}_${dateStr}_${generateUuid()}`;
  }

  private buildXml(input: ReportInput): string {
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);
    const quarter = input.period || 1;

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'CoopReports 1.0')
        .att('ВерсФорм', '5.03');

    const dokument = doc.ele('Документ')
      .att('КНД', '1110355')
      .att('ДатаДок', formatDate(new Date()))
      .att('КодНО', kodNO);

    dokument.ele('СвНП')
      .ele('НПЮЛ')
        .att('ИННЮЛ', input.inn)
        .att('КПП', input.kpp)
      .up()
    .up();

    addSigner(dokument, input.signerFio);

    dokument.ele('УвИсчСумНалог')
      .att('КППДекл', input.kpp)
      .att('ОКТМО', input.oktmo)
      .att('КБК', '18210501021011000110')
      .att('СумНалогАванс', '0')
      .att('Период', '21/01')
      .att('НомерМесКварт', String(quarter))
      .att('Год', String(input.year))
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
