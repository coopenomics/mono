import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';
import { createXmlDoc, formatDate, getTaxOfficeCode } from './xml-utils';
import { t } from '../../i18n';
import { DomainError } from '@coopenomics/extension-kit';

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
        t('reports.uusn.generationErrorMessage', { message: e instanceof Error ? e.message : String(e) }),
      );
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const kodNO = getTaxOfficeCode(organization.kpp);
    const quarter = header.period ?? 1;
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw DomainError.badRequest('REPORTS_UUSN_PERIOD_INVALID', { period: header.period });
    }
    // В XSD UT_UVISCHSUMNAL v5.03: Период ∈ {21,31,33,34}, НомерМесКварт ∈ {01..04}.
    const periodByQuarter: Record<number, string> = { 1: '21', 2: '31', 3: '33', 4: '34' };

    const doc = createXmlDoc()
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Файл')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИдФайл', header.idFile)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсПрог', header.versProgram)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсФорм', '5.03');

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const dokument = doc.ele('Документ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КНД', '1110355')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ДатаДок', header.docDate ?? formatDate(new Date()))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КодНО', kodNO);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    dokument.ele('СвНП')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('НПЮЛ')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИННЮЛ', organization.inn)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('КПП', organization.kpp)
      .up()
    .up();

    // Базовый подписант без <СвПред> — у уведомлений укороченный блок.
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const sig = dokument.ele('Подписант').att('ПрПодп', '1');
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const fio = sig.ele('ФИО')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Фамилия', signer.lastName)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Имя', signer.firstName);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (signer.middleName) fio.att('Отчество', signer.middleName);
    fio.up();
    sig.up();

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    dokument.ele('УвИсчСумНалог')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КППДекл', organization.kpp)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ОКТМО', organization.oktmo ?? '')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КБК', '18210501021011000110')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалогАванс', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Период', periodByQuarter[quarter])
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НомерМесКварт', String(quarter).padStart(2, '0'))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Год', String(header.reportYear))
    .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
