import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addSigner, getQuarterPeriodCode, getTaxOfficeCode } from './xml-utils';

/**
 * Генератор РСВ — Расчёт по страховым взносам (нулевой)
 * XSD: NO_RASCHSV_1_162_00_05_08_02.xsd
 * КНД: 1151111
 *
 * Структура: Файл → Документ → [СвНП, Подписант, РасчетСВ]
 * СвНП: @СрЧисл, @Тлф, НПЮЛ(@НаимОрг, @ИННЮЛ, @КПП)
 * РасчетСВ: ОбязПлатСВ(@ТипПлат, @ОКТМО, ...) для нулевого
 */
export class RsvGenerator implements IReportGenerator {
  readonly reportType = ReportType.RSV;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации РСВ: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `NO_RASCHSV_${input.inn}_${input.kpp}_${dateStr}_${generateUuid()}`;
  }

  private buildXml(input: ReportInput): string {
    const periodCode = getQuarterPeriodCode(input.period);
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'CoopReports 1.0')
        .att('ВерсФорм', '5.08');

    const dokument = doc.ele('Документ')
      .att('КНД', '1151111')
      .att('ДатаДок', formatDate(new Date()))
      .att('НомКорр', '0')
      .att('Период', periodCode)
      .att('ОтчетГод', String(input.year))
      .att('КодНО', kodNO)
      .att('ПоМесту', '214');

    dokument.ele('СвНП')
      .att('СрЧисл', '1')
      .ele('НПЮЛ')
        .att('НаимОрг', input.orgName)
        .att('ИННЮЛ', input.inn)
        .att('КПП', input.kpp)
      .up()
    .up();

    addSigner(dokument, input.signerFio);

    const raschSV = dokument.ele('РасчетСВ');
    const obyaz = raschSV.ele('ОбязПлатСВ')
      .att('ТипПлат', '1')
      .att('ОКТМО', input.oktmo);

    obyaz.ele('УплПерОПС')
      .att('КБК', '18210202010061010160')
      .att('СумСВУплПер', '0')
      .att('СумСВУпл1М', '0')
      .att('СумСВУпл2М', '0')
      .att('СумСВУпл3М', '0')
    .up();

    obyaz.up();
    raschSV.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
