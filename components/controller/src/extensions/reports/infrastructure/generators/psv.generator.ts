import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';
import {
  addHeaderMeta,
  createXmlDoc,
  getMonthPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';
import { t } from '../../i18n';

/**
 * ПСВ — Персонифицированные сведения (нулевой).
 * XSD: NO_PERSSVFL_1_297_00_05_01_02.xsd, КНД: 1151162, ВерсФорм 5.01.
 *
 * В нулевом отчёте — одна запись <ПерсСвФЛ> для подписанта (председателя)
 * с @СумВыпл=0. СНИЛС обязателен — берётся из signer.snils. ИНН — из
 * signer.inn: по XSD @ИННФЛ необязателен, но СФР отклоняет отчёт без него
 * (эталон принятого файла — Корректировки_отчетов/ПСВ).
 * СвНП @Тлф и краткое НаимОрг — по эталону принятого Астралом файла
 * (см. Корректировки_отчетов/ПСВ).
 */
export class PsvGenerator implements IReportGenerator {
  readonly reportType = ReportType.PSV;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    if (!edits.signer.inn) {
      errors.push(t('reports.psv.signerInnRequiredMessage'));
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(t('reports.psv.generationErrorMessage', { message: e instanceof Error ? e.message : String(e) }));
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const periodCode = getMonthPeriodCode(header.period ?? undefined);
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Файл')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИдФайл', header.idFile)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсПрог', header.versProgram)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсФорм', '5.01');

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const dokument = doc.ele('Документ').att('КНД', '1151162');
    addHeaderMeta(dokument, {
      docDate: header.docDate,
      period: periodCode,
      year: header.reportYear,
      kodNO,
      correctionNumber: header.correctionNumber,
      poMestu: '214',
    });

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const svnp = dokument.ele('СвНП');
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (organization.phone) svnp.att('Тлф', organization.phone);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    svnp.ele('НПЮЛ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НаимОрг', organization.orgName)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ИННЮЛ', organization.inn)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КПП', organization.kpp)
      .up();
    svnp.up();

    // ПСВ использует базовый <Подписант ПрПодп="1"> без <СвПред>, даже если
    // type=representative (это особенность формы — подписант персонифицированных
    // сведений по сути один и тот же ФИО как председатель).
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
    const persSv = dokument.ele('ПерсСвФЛ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ИННФЛ', signer.inn ?? '')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СНИЛС', signer.snils || '000-000-000 00')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумВыпл', '0');

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const persFio = persSv.ele('ФИО')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Фамилия', signer.lastName)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Имя', signer.firstName);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (signer.middleName) persFio.att('Отчество', signer.middleName);
    persFio.up();
    persSv.up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
