import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  IReportGenerator,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import type {
  BuhotchBalanceRowShape,
  BuhotchEditsShape,
} from '../../domain/edits-shapes/buhotch-edits.shape';
import { createXmlDoc } from './xml-utils';
import { t } from '../../i18n';
import { DomainError } from '@coopenomics/extension-kit';

/**
 * Генератор бухгалтерской отчётности НКО (КНД 0710096, ВерсФорм 5.04).
 *
 * Форма для некоммерческих организаций (потребкооперативов):
 *   - сокращённая структура <Баланс>: НеМатФинАкт, ДенежнСр, ФинВлож,
 *     ЦелевСредства (без ВнеОбА/ОбА/ДолгосрОбяз/КраткосрОбяз).
 *   - Период="91" (годовой НКО), КНД="0710096", ВерсФорм="5.04".
 *
 * После STORY-1-4 принимает edits-shape (POJO) вместо ReportInput. Вся логика
 * расчёта балансовых строк из ledger2 и корректировок живёт в
 * `ReportEditsBuilderService.buildBuhotch()`.
 */
export class BuhotchGenerator implements IReportGenerator {
  readonly reportType = ReportType.BUHOTCH;

  generate(input: unknown): ReportOutput {
    const edits = input as BuhotchEditsShape;
    const fileName = edits.header.idFile;
    const errors: string[] = [];
    try {
      const xml = this.buildXml(edits);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(t('reports.buhotch.generationErrorMessage', { message: e instanceof Error ? e.message : String(e) }));
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: BuhotchEditsShape): string {
    const { header, organization, signer, balance, notes } = edits;

    // correctionNumber валидация уже сделана в DTO (0..999), но защищаемся
    // от прямых вызовов generator'а в обход API.
    const corrRaw = header.correctionNumber ?? 0;
    if (!Number.isInteger(corrRaw) || corrRaw < 0 || corrRaw > 999) {
      throw DomainError.internal('REPORTS_BUHOTCH_CORRECTION_NUMBER_INVALID', { value: corrRaw });
    }
    const correctionNumber = String(corrRaw);
    const prPodp = signer.type === 'representative' ? '2' : '1';

    const doc = createXmlDoc()
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Файл')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ИдФайл', header.idFile)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсПрог', header.programVersion)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ВерсФорм', '5.04');

    const dokument = doc
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Документ')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('КНД', '0710096')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ДатаДок', header.docDate)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('Период', '91')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ОтчетГод', String(header.reportYear))
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('НомКорр', correctionNumber)
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ОКЕИ', '384')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ПрАудит', header.audit ? '1' : '0')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('ПрУтвер', header.approved ? '1' : '0');

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const svnp = dokument.ele('СвНП');
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (organization.okpo) svnp.att('ОКПО', organization.okpo);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    svnp.att('ОКФС', organization.okfs);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    svnp.att('ОКОПФ', organization.okopf);

    const npyl = svnp
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('НПЮЛ')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НаимОрг', organization.orgName)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('ИННЮЛ', organization.inn)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('КПП', organization.kpp);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (organization.address) npyl.att('АдрМН', organization.address);
    npyl.up();
    svnp.up();

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const signerEl = dokument.ele('Подписант').att('ПрПодп', prPodp);
    const fio = signerEl
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('ФИО')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Фамилия', signer.lastName)
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('Имя', signer.firstName);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (signer.middleName) fio.att('Отчество', signer.middleName);
    fio.up();
    if (signer.type === 'representative') {
      signerEl
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .ele('СвПред')
        // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
        .att('НаимДок', signer.repDoc ?? '')
        .up();
    }
    signerEl.up();

    // === Баланс (форма 0710001, НКО-структура) ===
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const balans = dokument.ele('Баланс').att('ОКУД', '0710001');

    const aktiv = balans
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Актив')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумОтч', String(balance.assetsTotal.otch))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумПрдщ', String(balance.assetsTotal.prev))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумПрдшв', String(balance.assetsTotal.prePrev));

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    this.addBalanceRow(aktiv, 'НеМатФинАкт', balance.nonMaterialAndLongFin);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    this.addBalanceRow(aktiv, 'ДенежнСр', balance.cash);
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    this.addBalanceRow(aktiv, 'ФинВлож', balance.shortTermFin);
    aktiv.up();

    const passiv = balans
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Пассив')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумОтч', String(balance.passivesTotal.otch))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумПрдщ', String(balance.passivesTotal.prev))
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('СумПрдшв', String(balance.passivesTotal.prePrev));

    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    this.addBalanceRow(passiv, 'ЦелевСредства', balance.targetFunds);
    passiv.up();
    balans.up();

    // `<Пояснения НаимФайлПЗ="...">` — обязательный (XSD minLength=1). Если
    // пользователь оставил пустую строку — подставляем "-" placeholder.
    dokument
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .ele('Пояснения')
      // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
      .att('НаимФайлПЗ', notes.explanationFileName?.trim() || '-')
      .up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }

  private addBalanceRow(
    parent: ReturnType<ReturnType<typeof createXmlDoc>['ele']>,
    tag: string,
    row: BuhotchBalanceRowShape | null,
  ): void {
    if (!row) return;
    if (!row.otch && !row.prev && !row.prePrev) return;
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    const el = parent.ele(tag).att('СумОтч', String(row.otch));
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (row.prev) el.att('СумПрдщ', String(row.prev));
    // i18n-ignore: официальная форма — имя тега/атрибута/константа XSD-схемы отчёта
    if (row.prePrev) el.att('СумПрдшв', String(row.prePrev));
    el.up();
  }
}

// Экспортируем наружу — используется в report-preview.service и
// report-edits-builder для единой арифметики округления: preview показывает
// председателю те же тысячи, что потом попадут в XML.
export function toThousands(rubles: number): number {
  return Math.round(rubles / 1000);
}
