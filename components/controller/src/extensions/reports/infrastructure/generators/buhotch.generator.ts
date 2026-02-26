import { ReportType } from '../../domain/enums/report-type.enum';
import type { IReportGenerator, ReportInput, ReportOutput } from '../../domain/interfaces/report-generator.interface';
import { createXmlDoc, formatDate, generateUuid, addFio } from './xml-utils';

/**
 * Генератор бухгалтерской отчётности (NO_BUHOTCH)
 * Формат: Приказ ФНС КЧ-17-18/692 от 11.03.2025
 * XSD: NO_BUHOTCH_1_105_00_05_09_01.xsd
 *
 * Кооператив обязан сдавать:
 *   - Баланс (форма 0710001)
 *   - Отчёт о целевом использовании средств (форма 0710006)
 *   - Отчёт о финансовых результатах — только при коммерческой деятельности
 *
 * Счета ledger:
 *   51 — Расчётный счёт (Актив → ОбА → Денежные средства, строка 1250)
 *   80 — Паевой фонд (Пассив → Капитал, строка 1310)
 *   86 — Целевое финансирование (Пассив → Капитал, строка 1350)
 */
export class BuhotchGenerator implements IReportGenerator {
  readonly reportType = ReportType.BUHOTCH;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];

    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e: any) {
      errors.push(`Ошибка генерации бухбаланса: ${e.message}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const uuid = generateUuid();
    return `NO_BUHOTCH_${input.inn}_${input.kpp}_${dateStr}_${uuid}`;
  }

  private getLedgerBalance(input: ReportInput, accountId: number) {
    const acc = input.ledgerData?.find(a => a.accountId === accountId);
    return {
      current: acc ? Math.round(acc.balanceCurrent / 1000) : 0,
      previous: acc ? Math.round(acc.balancePrevious / 1000) : 0,
      prePrevious: acc ? Math.round(acc.balancePrePrevious / 1000) : 0,
    };
  }

  private buildXml(input: ReportInput): string {
    const acc51 = this.getLedgerBalance(input, 51);
    const acc80 = this.getLedgerBalance(input, 80);
    const acc86 = this.getLedgerBalance(input, 86);

    const totalOba = { current: acc51.current, previous: acc51.previous, prePrevious: acc51.prePrevious };
    const totalAssets = { current: totalOba.current, previous: totalOba.previous, prePrevious: totalOba.prePrevious };
    const totalCapital = {
      current: acc80.current + acc86.current,
      previous: acc80.previous + acc86.previous,
      prePrevious: acc80.prePrevious + acc86.prePrevious,
    };
    const totalPassive = totalCapital;

    const idFile = this.generateFileName(input);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'CoopReports 1.0')
        .att('ВерсФорм', '5.09');

    const dokument = doc
      .ele('Документ')
        .att('КНД', '0710099')
        .att('ДатаДок', formatDate(new Date()))
        .att('Период', '34')
        .att('ОтчетГод', String(input.year))
        .att('НомКорр', '0')
        .att('ОКЕИ', '384')
        .att('ПрАудит', '0');

    const svnp = dokument.ele('СвНП')
      .att('ОКВЭД2', input.okved)
      .att('ОКФС', input.okfs)
      .att('ОКОПФ', input.okopf);

    if (input.okpo) {
      svnp.att('ОКПО', input.okpo);
    }

    svnp.ele('НПЮЛ')
      .att('НаимОрг', input.orgName)
      .att('ИННЮЛ', input.inn)
      .att('КПП', input.kpp)
      .att('АдрМН', input.address || '-')
    .up();
    svnp.up();

    const signer = dokument.ele('Подписант').att('ПрПодп', '1');
    addFio(signer, input.signerFio);
    signer.up();

    // === Баланс (форма 0710001) ===
    const balans = dokument.ele('Баланс').att('ОКУД', '0710001');
    const aktiv = balans.ele('Актив');

    aktiv.ele('ВнеОбА')
      .att('СумОтч', '0')
      .att('СумПрдщ', '0')
      .att('СумПрдшв', '0')
    .up();

    aktiv.ele('ОбА')
      .att('СумОтч', String(totalOba.current))
      .att('СумПрдщ', String(totalOba.previous))
      .att('СумПрдшв', String(totalOba.prePrevious))
    .up();

    aktiv
      .att('СумОтч', String(totalAssets.current))
      .att('СумПрдщ', String(totalAssets.previous))
      .att('СумПрдшв', String(totalAssets.prePrevious));
    aktiv.up();

    const passiv = balans.ele('Пассив');
    passiv.ele('ДолгосрОбяз')
      .att('СумОтч', '0')
      .att('СумПрдщ', '0')
      .att('СумПрдшв', '0')
    .up();

    passiv.ele('КраткосрОбяз')
      .att('СумОтч', '0')
      .att('СумПрдщ', '0')
      .att('СумПрдшв', '0')
    .up();

    passiv
      .att('ОКУД', '0710001')
      .att('СумОтч', String(totalPassive.current))
      .att('СумПрдщ', String(totalPassive.previous))
      .att('СумПрдшв', String(totalPassive.prePrevious));
    passiv.up();
    balans.up();

    // === Отчёт о целевом использовании средств (форма 0710006) ===
    const celIsp = dokument.ele('ЦелИсп').att('ОКУД', '0710006');

    celIsp.ele('ОстатНачОтч')
      .att('СумОтч', String(acc86.previous))
      .att('СумПред', String(acc86.prePrevious))
    .up();

    const postup = celIsp.ele('Поступило');
    postup.ele('ВступВзнос').att('СумОтч', '0').att('СумПред', '0').up();
    postup.ele('ЧленВзнос').att('СумОтч', '0').att('СумПред', '0').up();
    postup.ele('ЦелевВзнос').att('СумОтч', '0').att('СумПред', '0').up();
    postup.ele('ДобрИмВзнос').att('СумОтч', '0').att('СумПред', '0').up();
    postup.ele('ПрибПредДеят').att('СумОтч', '0').att('СумПред', '0').up();
    postup.ele('Прочие').att('СумОтч', '0').att('СумПред', '0').up();
    postup.att('СумОтч', '0').att('СумПред', '0');
    postup.up();

    const ispolz = celIsp.ele('Использовано');
    const rashCel = ispolz.ele('РасхЦелМер');
    rashCel.att('СумОтч', '0').att('СумПред', '0');
    rashCel.up();
    const rashAU = ispolz.ele('РасхСодАУ');
    rashAU.att('СумОтч', '0').att('СумПред', '0');
    rashAU.up();
    ispolz.ele('ПриобОСИн').att('СумОтч', '0').att('СумПред', '0').up();
    ispolz.ele('Прочие').att('СумОтч', '0').att('СумПред', '0').up();
    ispolz.att('СумОтч', '0').att('СумПред', '0');
    ispolz.up();

    celIsp.ele('ОстатКонОтч')
      .att('СумОтч', String(acc86.current))
      .att('СумПред', String(acc86.previous))
    .up();
    celIsp.up();

    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: true });
  }
}
