import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';
import { createXmlDoc, formatDate, getTaxOfficeCode } from './xml-utils';

/**
 * УВ_Взносы — Уведомление об исчисленных страховых взносах (нулевое).
 * XSD: UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd (общий с UUSN), КНД: 1110355.
 * Ежемесячная форма. period = 1..12 → month.
 * НомерМесКварт ∈ {11,12,13} — порядковый месяц квартала (11 = 1-й, 13 = 3-й).
 */
export class UvVznosyGenerator implements IReportGenerator {
  readonly reportType = ReportType.UV_VZNOSY;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(
        `Ошибка генерации уведомления о взносах: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const kodNO = getTaxOfficeCode(organization.kpp);
    const month = header.period ?? 1;
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(
        `uv-vznosy: period должен быть целым от 1 до 12 (получено: ${header.period})`,
      );
    }
    const quarter = Math.ceil(month / 3);
    const periodByQuarter: Record<number, string> = { 1: '21', 2: '31', 3: '33', 4: '34' };
    const periodCode = periodByQuarter[quarter];
    if (!periodCode) {
      throw new Error(`uv-vznosy: не удалось вывести код периода для месяца ${month}`);
    }
    const monthInQuarter = ((month - 1) % 3) + 1;

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
      .att('КБК', '18210202000011000160')
      .att('СумНалогАванс', '0')
      .att('Период', periodCode)
      .att('НомерМесКварт', String(10 + monthInQuarter))
      .att('Год', String(header.reportYear))
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
