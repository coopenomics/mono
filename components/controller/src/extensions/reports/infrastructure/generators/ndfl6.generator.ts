import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type {
  Ndfl6CertificateShape,
  Ndfl6EditsShape,
  Ndfl6TaxShape,
} from '../../domain/edits-shapes/ndfl6-edits.shape';
import { NDFL6_KBK, NDFL6_RATE } from '../../domain/edits-shapes/ndfl6-edits.shape';
import {
  addFlexibleSignerFromShape,
  addHeaderMeta,
  createXmlDoc,
  getQuarterPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';

/**
 * 6-НДФЛ — расчёт сумм налога, исчисленных и удержанных налоговым агентом.
 * Форма: КНД 1151100, ВерсФорм 5.05 (приказ ФНС от 18.10.2024 № ЕД-7-11/877@).
 *
 * Кооператив стал налоговым агентом с удержанием НДФЛ из материальной помощи,
 * поэтому форма перестала быть нулёвкой. Суммы приходят посчитанными в edits
 * (`Ndfl6DataService` собирает их из ledger2), генератор только раскладывает
 * их по разделам.
 *
 * Что важно не перепутать при правках:
 *
 *  - `СумНалУд` (строка 020) и `СумНалУдерж` (160) — **нарастающим итогом с
 *    начала года**, а шесть сроков (021–026 и 161–166) — только последний
 *    квартал отчётного периода. На бланке они идут под «в том числе», и
 *    совпадают с итогом лишь в отчёте за 1 квартал.
 *  - `СправДох` (приложение № 1) схема разрешает **только в годовом отчёте**;
 *    при периодах 21/31/33 наличие справки делает файл невалидным.
 *  - Суммы дохода и базы — с копейками, суммы налога — целыми рублями.
 */

/** Периоды, при которых схема допускает справки о доходах: годовой и ликвидационные. */
const PERIODS_WITH_CERTIFICATES = new Set(['34', '90', '51', '52', '53', '83', '84', '85', '86']);

/** Пустой расчёт — для черновиков, сохранённых до появления сумм в форме. */
const EMPTY_TAX: Ndfl6TaxShape = {
  peopleCount: 0,
  incomeTotal: 0,
  deductionsTotal: 0,
  taxBase: 0,
  taxCalculated: 0,
  withheldTotal: 0,
  byTerm: [0, 0, 0, 0, 0, 0],
};

export class Ndfl6Generator implements IReportGenerator {
  readonly reportType = ReportType.NDFL6;

  generate(input: unknown): ReportOutput {
    const edits = input as Ndfl6EditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации 6-НДФЛ: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: Ndfl6EditsShape): string {
    const { header, organization, signer } = edits;
    const tax = edits.tax ?? EMPTY_TAX;
    const periodCode = getQuarterPeriodCode(header.period ?? undefined);
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ВерсПрог', header.versProgram)
        .att('ВерсФорм', '5.05')
        .att('ИдФайл', header.idFile);

    const dokument = doc.ele('Документ')
      .att('КНД', '1151100');
    addHeaderMeta(dokument, {
      docDate: header.docDate,
      period: periodCode,
      year: header.reportYear,
      kodNO,
      correctionNumber: header.correctionNumber,
      poMestu: '214',
    });

    // ОКТМО в схеме обязателен: без него файл не пройдёт валидацию, поэтому
    // атрибут выводится всегда — пустое значение отловит XSD и покажет
    // бухгалтеру, что реквизит не заполнен.
    const svnp = dokument.ele('СвНП').att('ОКТМО', organization.oktmo ?? '');
    svnp.ele('НПЮЛ')
      .att('НаимОрг', organization.orgName)
      .att('ИННЮЛ', organization.inn)
      .att('КПП', organization.kpp)
      .up();
    svnp.up();

    addFlexibleSignerFromShape(dokument, signer);

    const ndfl = dokument.ele('НДФЛ6.2');
    this.addSection1(ndfl, tax);
    this.addSection2(ndfl, tax);

    if (PERIODS_WITH_CERTIFICATES.has(periodCode)) {
      for (const certificate of edits.certificates ?? []) {
        this.addCertificate(ndfl, certificate);
      }
    }

    ndfl.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }

  /** Раздел 1 — обязательства налогового агента. */
  private addSection1(parent: ReturnType<typeof createXmlDoc>, tax: Ndfl6TaxShape): void {
    const obyaz = parent.ele('ОбязНА')
      .att('КБК', NDFL6_KBK)
      .att('СумНалУд', this.formatTax(tax.withheldTotal))
      .att('СумНалВоз', '0');

    const sumUd = obyaz.ele('СведСумНалУд');
    tax.byTerm.forEach((value, index) => {
      sumUd.att(`СумНал${index + 1}Срок`, this.formatTax(value));
    });
    sumUd.up();

    // Возвратов излишне удержанного налога у кооператива не бывает: налог
    // удерживается ровно в момент выплаты, переудержать нечего.
    const sumVoz = obyaz.ele('СведСумНалВоз');
    for (let i = 1; i <= 6; i += 1) sumVoz.att(`СумНалВоз${i}Срок`, '0');
    sumVoz.up();

    obyaz.up();
  }

  /** Раздел 2 — расчёт исчисленных и удержанных сумм. */
  private addSection2(parent: ReturnType<typeof createXmlDoc>, tax: Ndfl6TaxShape): void {
    const rasch = parent.ele('РасчСумНал')
      .att('Ставка', String(NDFL6_RATE))
      .att('КБК', NDFL6_KBK)
      .att('КолФЛ', String(tax.peopleCount))
      // Высококвалифицированных специалистов у кооператива нет — это статус
      // иностранного работника по трудовому договору, а матпомощь платится
      // пайщику вне трудовых отношений.
      .att('КолКвал', '0')
      .att('СумНачислНач', this.formatMoney(tax.incomeTotal))
      .att('СумНачислКвал', '0')
      .att('СумВыч', this.formatMoney(tax.deductionsTotal))
      .att('НалБаза', this.formatMoney(tax.taxBase))
      .att('СумНалИсч', this.formatTax(tax.taxCalculated))
      .att('СумНалИсчКвал', '0')
      // Фиксированные авансовые платежи — по патенту иностранного работника;
      // зачёт налога на прибыль и налога, уплаченного за рубежом, — по
      // дивидендам. Ни того, ни другого в кооперативе не возникает.
      .att('СумФикс', '0')
      .att('СумНалПриб', '0')
      .att('СумНалИнГос', '0')
      .att('СумНалУдерж', this.formatTax(tax.withheldTotal));

    const monthAttrs = [
      'СумНалУдерж1Мес',
      'СумНалУдерж23_1Мес',
      'СумНалУдерж2Мес',
      'СумНалУдерж23_2Мес',
      'СумНалУдерж3Мес',
      'СумНалУдерж23_3Мес',
    ];
    tax.byTerm.forEach((value, index) => {
      rasch.att(monthAttrs[index], this.formatTax(value));
    });

    // Неудержанного налога не остаётся: удержание проводится раньше выплаты,
    // и при нехватке средств не проходит вся операция целиком.
    rasch.att('СумНалНеУдерж', '0').att('СумНалИзлУдерж', '0').att('СумНалВозвр', '0');
    for (const attr of [
      'СумНалВозвр1Мес',
      'СумНалВозвр23_1Мес',
      'СумНалВозвр2Мес',
      'СумНалВозвр23_2Мес',
      'СумНалВозвр3Мес',
      'СумНалВозвр23_3Мес',
    ]) {
      rasch.att(attr, '0');
    }
    rasch.up();
  }

  /** Приложение № 1 — справка о доходах и суммах налога физического лица. */
  private addCertificate(
    parent: ReturnType<typeof createXmlDoc>,
    certificate: Ndfl6CertificateShape,
  ): void {
    const sprav = parent.ele('СправДох')
      .att('НомСпр', String(certificate.number))
      .att('НомКорр', certificate.correctionNumber);

    const poluch = sprav.ele('ПолучДох')
      .att('Статус', certificate.taxpayerStatus)
      .att('ДатаРожд', certificate.birthDate)
      .att('Гражд', certificate.citizenshipCode);

    const fio = poluch.ele('ФИО')
      .att('Фамилия', certificate.lastName)
      .att('Имя', certificate.firstName);
    if (certificate.middleName) fio.att('Отчество', certificate.middleName);
    fio.up();

    poluch.ele('УдЛичнФЛ')
      .att('КодУдЛичн', certificate.documentTypeCode)
      .att('СерНомДок', certificate.documentSerialNumber)
      .up();
    poluch.up();

    const sved = sprav.ele('СведДох')
      .att('Ставка', String(NDFL6_RATE))
      .att('КБК', NDFL6_KBK);

    sved.ele('СумИтНалПер')
      .att('СумДохОбщ', this.formatMoney(certificate.incomeTotal))
      .att('НалБаза', this.formatMoney(certificate.taxBase))
      .att('НалИсчисл', this.formatTax(certificate.taxCalculated))
      .att('АвансПлатФикс', '0')
      .att('СумНалПрибЗач', '0')
      .att('СумНалИнГос', '0')
      .att('НалУдерж', this.formatTax(certificate.taxWithheld))
      .att('НалУдержЛиш', '0')
      .up();

    const dohVych = sved.ele('ДохВыч');
    for (const row of certificate.monthlyIncome) {
      dohVych.ele('СвСумДох')
        .att('Месяц', String(row.month).padStart(2, '0'))
        .att('КодДоход', row.incomeCode)
        .att('СумДоход', this.formatMoney(row.amount))
        .up();
    }
    dohVych.up();

    sved.up();
    sprav.up();
  }

  /** Доход, база и вычеты — с копейками; ноль эталон ФНС пишет как «0». */
  private formatMoney(value: number): string {
    if (!value) return '0';
    return value.toFixed(2);
  }

  /** Суммы налога — только целые рубли (схема объявляет их как integer). */
  private formatTax(value: number): string {
    return String(Math.round(value));
  }
}
