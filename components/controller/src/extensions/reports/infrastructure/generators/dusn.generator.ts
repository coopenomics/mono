import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportEditsShape } from '../../domain/edits-shapes/zero-report-edits.shape';
import {
  addFlexibleSignerFromShape,
  addHeaderMeta,
  createXmlDoc,
  getTaxOfficeCode,
} from './xml-utils';
import { t } from '../../i18n';

/**
 * ДУСН — Декларация по УСН (нулевая). Годовая форма.
 * Форма: КНД 1152017, ВерсФорм 5.09. ПоМесту="210".
 *
 * Эталон: `reports-standarts/ВОСХОД/NO_USN_*_20260409_*.xml`.
 * <УСН ОбНал="1">: РасчНал1 с ПризНП="1", ставка 0, все суммы 0.
 */
export class DusnGenerator implements IReportGenerator {
  readonly reportType = ReportType.DUSN;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(t('reports.dusn.generationErrorMessage', { message: e instanceof Error ? e.message : String(e) }));
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Файл')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсПрог', header.versProgram)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсФорм', '5.09')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИдФайл', header.idFile);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const dokument = doc.ele('Документ').att('КНД', '1152017');
    addHeaderMeta(dokument, {
      docDate: header.docDate,
      period: '34',
      year: header.reportYear,
      kodNO,
      correctionNumber: header.correctionNumber,
      poMestu: '210',
    });

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const svnp = dokument.ele('СвНП');
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

    addFlexibleSignerFromShape(dokument, signer);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const usn = dokument.ele('УСН').att('ОбНал', '1');
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const section = usn.ele('СумНалПУ_НП')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ОКТМО', organization.oktmo ?? '')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НалПУУменПер', '0');

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const rasch = section.ele('РасчНал1').att('ПризНП', '1');
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    rasch.ele('Доход').att('СумЗаНалПер', '0').up();
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    rasch.ele('Ставка').att('СтавкаНалПер', '0').up();
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    rasch.ele('Исчисл').att('СумЗаНалПер', '0').up();
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    rasch.ele('УменНал').att('СумЗаНалПер', '0').up();
    rasch.up();

    section.up();
    usn.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
