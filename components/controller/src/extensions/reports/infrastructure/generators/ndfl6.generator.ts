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
import { getNdflParams } from '../../domain/services/ndfl-reference';
import type { PersonalIncomeTax } from '@coopenomics/jurisdictions';
import {
  addFlexibleSignerFromShape,
  addHeaderMeta,
  createXmlDoc,
  getQuarterPeriodCode,
  getTaxOfficeCode,
} from './xml-utils';
import { t } from '../../i18n';

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
      errors.push(t('reports.ndfl6.generationErrorMessage', { message: e instanceof Error ? e.message : String(e) }));
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: Ndfl6EditsShape): string {
    const { header, organization, signer } = edits;
    const tax = edits.tax ?? EMPTY_TAX;
    const periodCode = getQuarterPeriodCode(header.period ?? undefined);
    const kodNO = getTaxOfficeCode(organization.kpp);

    const doc = createXmlDoc()
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Файл')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсПрог', header.versProgram)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсФорм', '5.05')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИдФайл', header.idFile);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const dokument = doc.ele('Документ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
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
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const svnp = dokument.ele('СвНП').att('ОКТМО', organization.oktmo ?? '');
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

    // Ставка и КБК — на отчётный год, а не на сегодня: пересобранный
    // прошлогодний отчёт обязан совпасть с тем, что сдавали.
    const params = getNdflParams(header.reportYear);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const ndfl = dokument.ele('НДФЛ6.2');
    this.addSection1(ndfl, tax, params);
    this.addSection2(ndfl, tax, params);

    if (PERIODS_WITH_CERTIFICATES.has(periodCode)) {
      for (const certificate of edits.certificates ?? []) {
        this.addCertificate(ndfl, certificate, params);
      }
    }

    ndfl.up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }

  /** Раздел 1 — обязательства налогового агента. */
  private addSection1(
    parent: ReturnType<typeof createXmlDoc>,
    tax: Ndfl6TaxShape,
    params: PersonalIncomeTax,
  ): void {
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const obyaz = parent.ele('ОбязНА')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КБК', params.kbk)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалУд', this.formatTax(tax.withheldTotal))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалВоз', '0');

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const sumUd = obyaz.ele('СведСумНалУд');
    tax.byTerm.forEach((value, index) => {
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      sumUd.att(`СумНал${index + 1}Срок`, this.formatTax(value));
    });
    sumUd.up();

    // Возвратов излишне удержанного налога у кооператива не бывает: налог
    // удерживается ровно в момент выплаты, переудержать нечего.
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const sumVoz = obyaz.ele('СведСумНалВоз');
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    for (let i = 1; i <= 6; i += 1) sumVoz.att(`СумНалВоз${i}Срок`, '0');
    sumVoz.up();

    obyaz.up();
  }

  /** Раздел 2 — расчёт исчисленных и удержанных сумм. */
  private addSection2(
    parent: ReturnType<typeof createXmlDoc>,
    tax: Ndfl6TaxShape,
    params: PersonalIncomeTax,
  ): void {
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const rasch = parent.ele('РасчСумНал')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Ставка', String(params.ratePercent))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КБК', params.kbk)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КолФЛ', String(tax.peopleCount))
      // Высококвалифицированных специалистов у кооператива нет — это статус
      // иностранного работника по трудовому договору, а матпомощь платится
      // пайщику вне трудовых отношений.
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КолКвал', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНачислНач', this.formatMoney(tax.incomeTotal))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНачислКвал', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумВыч', this.formatMoney(tax.deductionsTotal))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НалБаза', this.formatMoney(tax.taxBase))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалИсч', this.formatTax(tax.taxCalculated))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалИсчКвал', '0')
      // Фиксированные авансовые платежи — по патенту иностранного работника;
      // зачёт налога на прибыль и налога, уплаченного за рубежом, — по
      // дивидендам. Ни того, ни другого в кооперативе не возникает.
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумФикс', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалПриб', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалИнГос', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалУдерж', this.formatTax(tax.withheldTotal));

    const monthAttrs = [
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалУдерж1Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалУдерж23_1Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалУдерж2Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалУдерж23_2Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалУдерж3Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалУдерж23_3Мес',
    ];
    tax.byTerm.forEach((value, index) => {
      rasch.att(monthAttrs[index], this.formatTax(value));
    });

    // Неудержанного налога не остаётся: удержание проводится раньше выплаты,
    // и при нехватке средств не проходит вся операция целиком.
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    rasch.att('СумНалНеУдерж', '0').att('СумНалИзлУдерж', '0').att('СумНалВозвр', '0');
    for (const attr of [
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалВозвр1Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалВозвр23_1Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалВозвр2Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалВозвр23_2Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      'СумНалВозвр3Мес',
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
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
    params: PersonalIncomeTax,
  ): void {
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const sprav = parent.ele('СправДох')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НомСпр', String(certificate.number))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НомКорр', certificate.correctionNumber);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const poluch = sprav.ele('ПолучДох')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Статус', certificate.taxpayerStatus)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ДатаРожд', certificate.birthDate)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Гражд', certificate.citizenshipCode);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const fio = poluch.ele('ФИО')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Фамилия', certificate.lastName)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Имя', certificate.firstName);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (certificate.middleName) fio.att('Отчество', certificate.middleName);
    fio.up();

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    poluch.ele('УдЛичнФЛ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КодУдЛичн', certificate.documentTypeCode)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СерНомДок', certificate.documentSerialNumber)
      .up();
    poluch.up();

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const sved = sprav.ele('СведДох')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Ставка', String(params.ratePercent))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КБК', params.kbk);

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    sved.ele('СумИтНалПер')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумДохОбщ', this.formatMoney(certificate.incomeTotal))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НалБаза', this.formatMoney(certificate.taxBase))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НалИсчисл', this.formatTax(certificate.taxCalculated))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('АвансПлатФикс', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалПрибЗач', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумНалИнГос', '0')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НалУдерж', this.formatTax(certificate.taxWithheld))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НалУдержЛиш', '0')
      .up();

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const dohVych = sved.ele('ДохВыч');
    for (const row of certificate.monthlyIncome) {
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      dohVych.ele('СвСумДох')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('Месяц', String(row.month).padStart(2, '0'))
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('КодДоход', row.incomeCode)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
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
