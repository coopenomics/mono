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
      errors.push(`Ошибка генерации ДУСН: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ВерсПрог', header.versProgram)
        .att('ВерсФорм', '5.09')
        .att('ИдФайл', header.idFile);

    const dokument = doc.ele('Документ').att('КНД', '1152017');
    addHeaderMeta(dokument, {
      docDate: header.docDate,
      period: '34',
      year: header.reportYear,
      kodNO,
      correctionNumber: header.correctionNumber,
      poMestu: '210',
    });

    const svnp = dokument.ele('СвНП');
    svnp.ele('НПЮЛ')
      .att('НаимОрг', organization.orgName)
      .att('ИННЮЛ', organization.inn)
      .att('КПП', organization.kpp)
      .up();
    svnp.up();

    addFlexibleSignerFromShape(dokument, signer);

    const usn = dokument.ele('УСН').att('ОбНал', '1');
    const section = usn.ele('СумНалПУ_НП')
      .att('ОКТМО', organization.oktmo ?? '')
      .att('НалПУУменПер', '0');

    const rasch = section.ele('РасчНал1').att('ПризНП', '1');
    rasch.ele('Доход').att('СумЗаНалПер', '0').up();
    rasch.ele('Ставка').att('СтавкаНалПер', '0').up();
    rasch.ele('Исчисл').att('СумЗаНалПер', '0').up();
    rasch.ele('УменНал').att('СумЗаНалПер', '0').up();
    rasch.up();

    section.up();
    usn.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
