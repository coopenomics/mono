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
  getQuarterPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';

/** КБК ОПС (обязательные пенсионные взносы) — эталон принятого Астралом нулевого РСВ. */
const KBK_OPS = '18210201000011000160';
/** КБК ОПС доп. тариф — тот же эталон. */
const KBK_OPS_DOP = '18210204010011010160';

/**
 * РСВ — Расчёт по страховым взносам (нулевой).
 *
 * Форма: КНД 1151111, ВерсФорм 5.08.
 *
 * Нулевой отчёт (эталон Корректировки_отчетов/РСВ, принят Астралом):
 *   - СвНП @СрЧисл="0" @Тлф=… (СрЧисл обязателен при ПоМесту=214);
 *   - РасчетСВ/ОбязПлатСВ с нулевыми УплПерОПС + УплПерОПСДоп
 *     (пустой <РасчетСВ/> ФНС отклоняет);
 *   - краткое НаимОрг.
 * Подписант — с <СвПред НаимДок="..." НаимОрг="..."> (опция svPredNaimOrg).
 */
export class RsvGenerator implements IReportGenerator {
  readonly reportType = ReportType.RSV;

  generate(input: unknown): ReportOutput {
    const edits = input as ZeroReportEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации РСВ: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const periodCode = getQuarterPeriodCode(header.period ?? undefined);
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ВерсПрог', header.versProgram)
        .att('ВерсФорм', '5.08')
        .att('ИдФайл', header.idFile);

    const dokument = doc.ele('Документ').att('КНД', '1151111');
    addHeaderMeta(dokument, {
      docDate: header.docDate,
      period: periodCode,
      year: header.reportYear,
      kodNO,
      correctionNumber: header.correctionNumber,
      poMestu: '214',
    });

    const svnp = dokument.ele('СвНП');
    // СрЧисл обязателен при ПоМесту≠335/222 (Schematron XSD). Нулёвка → 0.
    svnp.att('СрЧисл', '0');
    if (organization.phone) svnp.att('Тлф', organization.phone);
    svnp.ele('НПЮЛ')
      .att('НаимОрг', organization.orgName)
      .att('ИННЮЛ', organization.inn)
      .att('КПП', organization.kpp)
      .up();
    svnp.up();

    addFlexibleSignerFromShape(dokument, signer, {
      svPredNaimOrg: true,
      orgName: organization.orgName,
    });

    const raschet = dokument.ele('РасчетСВ');
    const obyaz = raschet
      .ele('ОбязПлатСВ')
      .att('ТипПлат', '2')
      .att('ОКТМО', organization.oktmo ?? '');

    obyaz
      .ele('УплПерОПС')
      .att('КБК', KBK_OPS)
      .att('СумСВУплПер', '0')
      .att('СумСВУпл1М', '0')
      .att('СумСВУпл2М', '0')
      .att('СумСВУпл3М', '0')
      .up();

    obyaz
      .ele('УплПерОПСДоп')
      .att('КБК', KBK_OPS_DOP)
      .att('СумСВУплПер', '0')
      .att('СумСВУпл1М', '0')
      .att('СумСВУпл2М', '0')
      .att('СумСВУпл3М', '0')
      .up();

    obyaz.up();
    raschet.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
