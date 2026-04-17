import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import {
  addFlexibleSigner,
  createXmlDoc,
  formatDate,
  generateFnsFileName,
  getQuarterPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';

/**
 * 6-НДФЛ — нулевая отчётность.
 *
 * Форма: КНД 1151100, ВерсФорм 5.05. Эталон —
 * `reports-standarts/ВОСХОД/NO_NDFL6.2_*_20260409_*.xml`.
 *
 * В нулевом отчёте один блок <ОбязНА> (с КБК, СумНалУд=0, СумНалВоз=0, двумя
 * дочерними <СведСумНалУд>/<СведСумНалВоз> по 6 срокам) и один блок
 * <РасчСумНал> со всеми атрибутами суммы = 0 и Ставка=13.
 */
const KBK_NDFL = '18210102010011000110';

const ND_UD_ZEROES = {
  СумНал1Срок: '0',
  СумНал2Срок: '0',
  СумНал3Срок: '0',
  СумНал4Срок: '0',
  СумНал5Срок: '0',
  СумНал6Срок: '0',
};

const ND_VOZ_ZEROES = {
  СумНалВоз1Срок: '0',
  СумНалВоз2Срок: '0',
  СумНалВоз3Срок: '0',
  СумНалВоз4Срок: '0',
  СумНалВоз5Срок: '0',
  СумНалВоз6Срок: '0',
};

const RASCH_ZEROES = {
  КолФЛ: '0',
  КолКвал: '0',
  СумНачислНач: '0',
  СумНачислКвал: '0',
  СумВыч: '0',
  НалБаза: '0',
  СумНалИсч: '0',
  СумНалИсчКвал: '0',
  СумФикс: '0',
  СумНалПриб: '0',
  СумНалИнГос: '0',
  СумНалУдерж: '0',
  СумНалУдерж1Мес: '0',
  СумНалУдерж23_1Мес: '0',
  СумНалУдерж2Мес: '0',
  СумНалУдерж23_2Мес: '0',
  СумНалУдерж3Мес: '0',
  СумНалУдерж23_3Мес: '0',
  СумНалНеУдерж: '0',
  СумНалИзлУдерж: '0',
  СумНалВозвр: '0',
  СумНалВозвр1Мес: '0',
  СумНалВозвр23_1Мес: '0',
  СумНалВозвр2Мес: '0',
  СумНалВозвр23_2Мес: '0',
  СумНалВозвр3Мес: '0',
  СумНалВозвр23_3Мес: '0',
};

export class Ndfl6Generator implements IReportGenerator {
  readonly reportType = ReportType.NDFL6;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];
    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации 6-НДФЛ: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    return generateFnsFileName('NO_NDFL6.2', input);
  }

  private buildXml(input: ReportInput): string {
    const periodCode = getQuarterPeriodCode(input.period);
    const idFile = this.generateFileName(input);
    const kodNO = getTaxOfficeCode(input.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ВерсПрог', 'Платформа отчётности кооператива 1.0')
        .att('ВерсФорм', '5.05')
        .att('ИдФайл', idFile);

    const dokument = doc.ele('Документ')
      .att('КНД', '1151100')
      .att('ДатаДок', formatDate(new Date()))
      .att('Период', periodCode)
      .att('ОтчетГод', String(input.year))
      .att('КодНО', kodNO)
      .att('НомКорр', String(input.correctionNumber ?? 0))
      .att('ПоМесту', '214');

    const svnp = dokument.ele('СвНП').att('ОКТМО', input.oktmo);
    svnp.ele('НПЮЛ')
      .att('НаимОрг', input.orgName)
      .att('ИННЮЛ', input.inn)
      .att('КПП', input.kpp)
      .up();
    svnp.up();

    addFlexibleSigner(dokument, input);

    const ndfl = dokument.ele('НДФЛ6.2');

    const obyaz = ndfl.ele('ОбязНА')
      .att('КБК', KBK_NDFL)
      .att('СумНалУд', '0')
      .att('СумНалВоз', '0');

    const sumUd = obyaz.ele('СведСумНалУд');
    for (const [k, v] of Object.entries(ND_UD_ZEROES)) sumUd.att(k, v);
    sumUd.up();

    const sumVoz = obyaz.ele('СведСумНалВоз');
    for (const [k, v] of Object.entries(ND_VOZ_ZEROES)) sumVoz.att(k, v);
    sumVoz.up();

    obyaz.up();

    const rasch = ndfl.ele('РасчСумНал').att('Ставка', '13').att('КБК', KBK_NDFL);
    for (const [k, v] of Object.entries(RASCH_ZEROES)) rasch.att(k, v);
    rasch.up();

    ndfl.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}
