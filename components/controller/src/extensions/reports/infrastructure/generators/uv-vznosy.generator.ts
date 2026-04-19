import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addSigner, getTaxOfficeCode } from './xml-utils';

/**
 * Генератор Уведомления об исчисленных страховых взносах (нулевое)
 * XSD: UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd
 * КНД: 1110355
 *
 * Структура: Файл → Документ → [СвНП, Подписант, УвИсчСумНалог[]]
 * СвНП: НПЮЛ(@ИННЮЛ, @КПП)
 * УвИсчСумНалог: @ОКТМО, @КБК, @СумНалогАванс, @Период, @НомерМесКварт, @Год
 */
export class UvVznosyGenerator implements IReportGenerator {
  readonly reportType = ReportType.UV_VZNOSY;

  generate(input: ReportInput): ReportOutput {
    // Кэшируем filename — он же ИдФайл в XML.
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input, fileName);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации уведомления о взносах: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `UT_UVISCHSUMNAL_${input.inn}_${input.kpp}_${dateStr}_${generateUuid()}`;
  }

  private buildXml(input: ReportInput, idFile: string): string {
    const kodNO = getTaxOfficeCode(input.kpp);
    // Валидация месяца: XSD требует НомерМесКварт ∈ {11,12,13} (один из трёх
    // месяцев квартала) → допустимый period = 1..12.
    const month = input.period ?? 1;
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(
        `uv-vznosy: input.period должен быть целым от 1 до 12 (получено: ${input.period})`,
      );
    }
    // По XSD (UT_UVISCHSUMNAL v5.03):
    //   Период ∈ {21,31,33,34} — код квартала подачи,
    //   НомерМесКварт ∈ {11,12,13} — порядковый месяц внутри квартала (для
    //   ежемесячных уведомлений о взносах).
    const quarter = Math.ceil(month / 3);
    const periodByQuarter: Record<number, string> = { 1: '21', 2: '31', 3: '33', 4: '34' };
    const periodCode = periodByQuarter[quarter];
    if (!periodCode) {
      // math гарантирует 1..4 при month 1..12, но защита от будущих правок.
      throw new Error(`uv-vznosy: не удалось вывести код периода для месяца ${month}`);
    }
    const monthInQuarter = ((month - 1) % 3) + 1;

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
      .att('КБК', '18210202000011000160')
      .att('СумНалогАванс', '0')
      .att('Период', periodCode)
      .att('НомерМесКварт', String(10 + monthInQuarter))
      .att('Год', String(input.year))
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
