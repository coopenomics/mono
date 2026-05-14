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
      errors.push(`Ошибка генерации бухбаланса: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  private buildXml(edits: BuhotchEditsShape): string {
    const { header, organization, signer, balance, notes } = edits;

    // correctionNumber валидация уже сделана в DTO (0..999), но защищаемся
    // от прямых вызовов generator'а в обход API.
    const corrRaw = header.correctionNumber ?? 0;
    if (!Number.isInteger(corrRaw) || corrRaw < 0 || corrRaw > 999) {
      throw new Error(`buhotch: correctionNumber должен быть целым 0..999 (получено: ${corrRaw})`);
    }
    const correctionNumber = String(corrRaw);
    const prPodp = signer.type === 'representative' ? '2' : '1';

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', header.idFile)
        .att('ВерсПрог', header.programVersion)
        .att('ВерсФорм', '5.04');

    const dokument = doc
      .ele('Документ')
        .att('КНД', '0710096')
        .att('ДатаДок', header.docDate)
        .att('Период', '91')
        .att('ОтчетГод', String(header.reportYear))
        .att('НомКорр', correctionNumber)
        .att('ОКЕИ', '384')
        .att('ПрАудит', header.audit ? '1' : '0')
        .att('ПрУтвер', header.approved ? '1' : '0');

    const svnp = dokument.ele('СвНП');
    if (organization.okpo) svnp.att('ОКПО', organization.okpo);
    svnp.att('ОКФС', organization.okfs);
    svnp.att('ОКОПФ', organization.okopf);

    const npyl = svnp
      .ele('НПЮЛ')
      .att('НаимОрг', organization.orgName)
      .att('ИННЮЛ', organization.inn)
      .att('КПП', organization.kpp);
    if (organization.address) npyl.att('АдрМН', organization.address);
    npyl.up();
    svnp.up();

    const signerEl = dokument.ele('Подписант').att('ПрПодп', prPodp);
    const fio = signerEl
      .ele('ФИО')
      .att('Фамилия', signer.lastName)
      .att('Имя', signer.firstName);
    if (signer.middleName) fio.att('Отчество', signer.middleName);
    fio.up();
    if (signer.type === 'representative') {
      signerEl
        .ele('СвПред')
        .att('НаимДок', signer.repDoc ?? '')
        .up();
    }
    signerEl.up();

    // === Баланс (форма 0710001, НКО-структура) ===
    const balans = dokument.ele('Баланс').att('ОКУД', '0710001');

    const aktiv = balans
      .ele('Актив')
      .att('СумОтч', String(balance.assetsTotal.otch))
      .att('СумПрдщ', String(balance.assetsTotal.prev))
      .att('СумПрдшв', String(balance.assetsTotal.prePrev));

    this.addBalanceRow(aktiv, 'НеМатФинАкт', balance.nonMaterialAndLongFin);
    this.addBalanceRow(aktiv, 'ДенежнСр', balance.cash);
    this.addBalanceRow(aktiv, 'ФинВлож', balance.shortTermFin);
    aktiv.up();

    const passiv = balans
      .ele('Пассив')
      .att('СумОтч', String(balance.passivesTotal.otch))
      .att('СумПрдщ', String(balance.passivesTotal.prev))
      .att('СумПрдшв', String(balance.passivesTotal.prePrev));

    this.addBalanceRow(passiv, 'ЦелевСредства', balance.targetFunds);
    passiv.up();
    balans.up();

    // `<Пояснения НаимФайлПЗ="...">` — обязательный (XSD minLength=1). Если
    // пользователь оставил пустую строку — подставляем "-" placeholder.
    dokument
      .ele('Пояснения')
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
    const el = parent.ele(tag).att('СумОтч', String(row.otch));
    if (row.prev) el.att('СумПрдщ', String(row.prev));
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
