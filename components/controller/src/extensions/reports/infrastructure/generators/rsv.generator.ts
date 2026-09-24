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
import { t } from '../../i18n';

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
      errors.push(t('reports.rsv.generationErrorMessage', { message: e instanceof Error ? e.message : String(e) }));
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: ZeroReportEditsShape): string {
    const { header, organization, signer } = edits;
    const periodCode = getQuarterPeriodCode(header.period ?? undefined);
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Файл')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсПрог', header.versProgram)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсФорм', '5.08')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИдФайл', header.idFile);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const dokument = doc.ele('Документ').att('КНД', '1151111');
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
    // СрЧисл обязателен при ПоМесту≠335/222 (Schematron XSD). Нулёвка → 0.
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    svnp.att('СрЧисл', '0');
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

    addFlexibleSignerFromShape(dokument, signer, {
      svPredNaimOrg: true,
      orgName: organization.orgName,
    });

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const raschet = dokument.ele('РасчетСВ');
    const obyaz = raschet
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('ОбязПлатСВ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ТипПлат', '2')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ОКТМО', organization.oktmo ?? '');

    obyaz
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('УплПерОПС')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КБК', KBK_OPS)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУплПер', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУпл1М', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУпл2М', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУпл3М', '0')
      .up();

    obyaz
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('УплПерОПСДоп')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КБК', KBK_OPS_DOP)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУплПер', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУпл1М', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУпл2М', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумСВУпл3М', '0')
      .up();

    obyaz.up();
    raschet.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
