import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';
import { createXmlDoc, formatDate, getTaxOfficeCode } from './xml-utils';

/**
 * УУСН / УВ_Взносы — Уведомление об исчисленных суммах авансовых платежей.
 * XSD: UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd, КНД: 1110355, ВерсФорм 5.03.
 * Квартальная форма, сдаётся до 25-го числа.
 */
export class UusnGenerator implements IReportGenerator {
  readonly reportType = ReportType.UUSN;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(
        `Ошибка генерации уведомления по УСН: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const kodNO = getTaxOfficeCode(organization.kpp);
    const quarter = header.period ?? 1;
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new Error(
        `uusn: period должен быть целым от 1 до 4 (получено: ${header.period})`,
      );
    }
    // В XSD UT_UVISCHSUMNAL v5.03: Период ∈ {21,31,33,34}, НомерМесКварт ∈ {01..04}.
    const periodByQuarter: Record<number, string> = { 1: '21', 2: '31', 3: '33', 4: '34' };

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', header.idFile)
        .att('ВерсПрог', header.versProgram)
        .att('ВерсФорм', '5.03');

    const dokument = doc.ele('Документ')
      .att('КНД', '1110355')
      .att('ДатаДок', header.docDate ?? formatDate(new Date()))
      .att('КодНО', kodNO);

    dokument.ele('СвНП')
      .ele('НПЮЛ')
        .att('ИННЮЛ', organization.inn)
        .att('КПП', organization.kpp)
      .up()
    .up();

    // Базовый подписант без <СвПред> — у уведомлений укороченный блок.
    const sig = dokument.ele('Подписант').att('ПрПодп', '1');
    const fio = sig.ele('ФИО')
      .att('Фамилия', signer.lastName)
      .att('Имя', signer.firstName);
    if (signer.middleName) fio.att('Отчество', signer.middleName);
    fio.up();
    sig.up();

    dokument.ele('УвИсчСумНалог')
      .att('КППДекл', organization.kpp)
      .att('ОКТМО', organization.oktmo ?? '')
      .att('КБК', '18210501021011000110')
      .att('СумНалогАванс', '0')
      .att('Период', periodByQuarter[quarter])
      .att('НомерМесКварт', String(quarter).padStart(2, '0'))
      .att('Год', String(header.reportYear))
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
