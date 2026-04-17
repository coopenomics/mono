import { ReportType } from '../../domain/enums/report-type.enum';
import type {
  BalanceCorrectionInput,
  IReportGenerator,
  LedgerAccountData,
  ReportInput,
  ReportOutput,
} from '../../domain/interfaces/report-generator.interface';
import { randomUUID } from 'crypto';
import { createXmlDoc, formatDate } from './xml-utils';

/**
 * Генератор бухгалтерской отчётности НКО (КНД 0710096, ВерсФорм 5.04).
 *
 * Форма для некоммерческих организаций (потребкооперативов):
 *   - сокращённая структура <Баланс>: НеМатФинАкт, ДенежнСр, ФинВлож,
 *     ЦелевСредства (без ВнеОбА/ОбА/ДолгосрОбяз/КраткосрОбяз).
 *   - Период="91" (годовой НКО), КНД="0710096", ВерсФорм="5.04".
 *
 * Эталон: `reports-standarts/ВОСХОД/NO_BOUPR_7728_*_20260409_*.xml`.
 *
 * Маппинг ledger2::accounts → строки баланса (в тыс. рублей, округление вниз):
 *   - ДенежнСр   = Σ balance(50, 51, 52, 55) — касса/банковские счета.
 *   - НеМатФинАкт = Σ balance(04, 08, 58*)_long_term — НМА и долгосрочные фин.вложения.
 *                  В MVP обычно 0; рассчитывается как сумма по меткам счетов.
 *   - ФинВлож    = Σ balance(58, 62_dr, 76_dr)_short_term — краткосрочные фин. активы.
 *                  В MVP обычно 0.
 *   - ЦелевСредства = Σ balance(80, 86xx) — паевой фонд + целевые поступления.
 *
 * Суммы за предыдущий и год до предыдущего (СумПрдщ, СумПрдшв) берутся из
 * input.corrections[] — ручные корректировки, которые пользователь вводит
 * в форме перед генерацией. При отсутствии — 0.
 *
 * ВАЖНО: знак `balanceCurrent` в `LedgerAccountData` — это уже нормированный
 * остаток с учётом типа счёта (ACTIVE → debit-credit, PASSIVE → credit-debit).
 * Здесь суммируем абсолютные значения в нужные строки (активы положительны,
 * пассивы положительны по своей природе).
 */

const ACCOUNT_GROUPS = {
  cash: [50000, 51000, 52000, 55000],
  nonMaterialAndLongFin: [1000, 4000, 8000, 583000],
  shortTermFin: [58000, 581000, 582000, 62000, 76000],
  targetFunds: [80000, 86000, 861000, 862000, 863000, 864000, 865000, 866000, 867000, 868000],
} as const;

interface BalanceRow {
  otch: number;
  prdш: number;
  prdsh: number;
}

function emptyRow(): BalanceRow {
  return { otch: 0, prdш: 0, prdsh: 0 };
}

function toThousands(rubles: number): number {
  return Math.round(rubles / 1000);
}

export class BuhotchGenerator implements IReportGenerator {
  readonly reportType = ReportType.BUHOTCH;

  generate(input: ReportInput): ReportOutput {
    const fileName = this.generateFileName(input);
    const errors: string[] = [];
    try {
      const xml = this.buildXml(input);
      return { reportType: this.reportType, xml, fileName, errors, isValid: true };
    } catch (e) {
      errors.push(`Ошибка генерации бухбаланса: ${e instanceof Error ? e.message : String(e)}`);
      return { reportType: this.reportType, xml: '', fileName, errors, isValid: false };
    }
  }

  generateFileName(input: ReportInput): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    // Формат имени (эталон ВОСХОДа):
    //   NO_BOUPR_<toTax>_<fromTax>_<unit>_<YYYYMMDD>_<GUID>
    // где unit = ИНН + КПП (без доп. суффиксов), toTax=fromTax=первые 4 цифры КПП.
    const unit = `${input.inn}${input.kpp}`;
    const tax = input.kpp.substring(0, 4);
    return `NO_BOUPR_${tax}_${tax}_${unit}_${dateStr}_${randomUUID()}`;
  }

  private sumGroup(
    ledger: LedgerAccountData[] | undefined,
    ids: readonly number[]
  ): number {
    if (!ledger) return 0;
    let total = 0;
    for (const acc of ledger) {
      if (ids.includes(acc.accountId)) {
        total += acc.balanceCurrent;
      }
    }
    return total;
  }

  /**
   * Возвращает корректировку для счёта в тыс. рублей. Сопоставление по
   * displayId — как пишется в плане счетов («51», «80», «86.01»).
   * Номер ledger2 id связан с displayId делением на 1000 для интегральных
   * счетов и делением на 1000 для субсчетов (`86010` → «86.01»? нет —
   * у нас смещение `id*1000` → `86.01` хранится как `861000`).
   */
  private findCorrectionByLedgerIds(
    corrections: BalanceCorrectionInput[] | undefined,
    ids: readonly number[]
  ): { balancePrevious: number; balancePrePrevious: number } {
    if (!corrections) return { balancePrevious: 0, balancePrePrevious: 0 };
    let prev = 0;
    let pre = 0;
    for (const c of corrections) {
      const displayIdLedger = ledger2DisplayIdToLedgerIds(c.accountDisplayId);
      if (displayIdLedger.some((id) => ids.includes(id))) {
        prev += c.balancePrevious;
        pre += c.balancePrePrevious;
      }
    }
    return { balancePrevious: prev, balancePrePrevious: pre };
  }

  private rowForGroup(input: ReportInput, ids: readonly number[]): BalanceRow {
    const otchRub = this.sumGroup(input.ledgerData, ids);
    const correction = this.findCorrectionByLedgerIds(input.corrections, ids);
    return {
      otch: toThousands(otchRub),
      prdш: toThousands(correction.balancePrevious),
      prdsh: toThousands(correction.balancePrePrevious),
    };
  }

  private buildXml(input: ReportInput): string {
    const nonMatFin = this.rowForGroup(input, ACCOUNT_GROUPS.nonMaterialAndLongFin);
    const cash = this.rowForGroup(input, ACCOUNT_GROUPS.cash);
    const finInv = this.rowForGroup(input, ACCOUNT_GROUPS.shortTermFin);
    const target = this.rowForGroup(input, ACCOUNT_GROUPS.targetFunds);

    const assetsTotal: BalanceRow = {
      otch: nonMatFin.otch + cash.otch + finInv.otch,
      prdш: nonMatFin.prdш + cash.prdш + finInv.prdш,
      prdsh: nonMatFin.prdsh + cash.prdsh + finInv.prdsh,
    };
    const passivesTotal: BalanceRow = { ...target };

    const idFile = this.generateFileName(input);
    const signerType = input.signerType ?? 'chairman';
    const prPodp = signerType === 'representative' ? '2' : '1';
    const correctionNumber = String(input.correctionNumber ?? 0);

    const doc = createXmlDoc()
      .ele('Файл')
        .att('ИдФайл', idFile)
        .att('ВерсПрог', 'Платформа отчётности кооператива 1.0')
        .att('ВерсФорм', '5.04');

    const dokument = doc
      .ele('Документ')
        .att('КНД', '0710096')
        .att('ДатаДок', formatDate(new Date()))
        .att('Период', '91')
        .att('ОтчетГод', String(input.year))
        .att('НомКорр', correctionNumber)
        .att('ОКЕИ', '384')
        .att('ПрАудит', '0')
        .att('ПрУтвер', '0');

    const svnp = dokument.ele('СвНП');
    if (input.okpo) svnp.att('ОКПО', input.okpo);
    svnp.att('ОКФС', input.okfs);
    svnp.att('ОКОПФ', input.okopf);

    const npyl = svnp.ele('НПЮЛ')
      .att('НаимОрг', input.orgName)
      .att('ИННЮЛ', input.inn)
      .att('КПП', input.kpp);
    if (input.address) npyl.att('АдрМН', input.address);
    npyl.up();
    svnp.up();

    const signer = dokument.ele('Подписант').att('ПрПодп', prPodp);
    const fio = signer.ele('ФИО')
      .att('Фамилия', input.signerFio.lastName)
      .att('Имя', input.signerFio.firstName);
    if (input.signerFio.middleName) fio.att('Отчество', input.signerFio.middleName);
    fio.up();
    if (signerType === 'representative') {
      signer.ele('СвПред')
        .att('НаимДок', input.signerRepDoc ?? '')
      .up();
    }
    signer.up();

    // === Баланс (форма 0710001, НКО-структура) ===
    const balans = dokument.ele('Баланс').att('ОКУД', '0710001');

    const aktiv = balans.ele('Актив')
      .att('СумОтч', String(assetsTotal.otch))
      .att('СумПрдщ', String(assetsTotal.prdш))
      .att('СумПрдшв', String(assetsTotal.prdsh));

    if (nonMatFin.otch || nonMatFin.prdш || nonMatFin.prdsh) {
      const el = aktiv.ele('НеМатФинАкт').att('СумОтч', String(nonMatFin.otch));
      if (nonMatFin.prdш) el.att('СумПрдщ', String(nonMatFin.prdш));
      if (nonMatFin.prdsh) el.att('СумПрдшв', String(nonMatFin.prdsh));
      el.up();
    }
    if (cash.otch || cash.prdш || cash.prdsh) {
      const el = aktiv.ele('ДенежнСр').att('СумОтч', String(cash.otch));
      if (cash.prdш) el.att('СумПрдщ', String(cash.prdш));
      if (cash.prdsh) el.att('СумПрдшв', String(cash.prdsh));
      el.up();
    }
    if (finInv.otch || finInv.prdш || finInv.prdsh) {
      const el = aktiv.ele('ФинВлож').att('СумОтч', String(finInv.otch));
      if (finInv.prdш) el.att('СумПрдщ', String(finInv.prdш));
      if (finInv.prdsh) el.att('СумПрдшв', String(finInv.prdsh));
      el.up();
    }
    aktiv.up();

    const passiv = balans.ele('Пассив')
      .att('СумОтч', String(passivesTotal.otch))
      .att('СумПрдщ', String(passivesTotal.prdш))
      .att('СумПрдшв', String(passivesTotal.prdsh));

    if (target.otch || target.prdш || target.prdsh) {
      const el = passiv.ele('ЦелевСредства').att('СумОтч', String(target.otch));
      if (target.prdш) el.att('СумПрдщ', String(target.prdш));
      if (target.prdsh) el.att('СумПрдшв', String(target.prdsh));
      el.up();
    }
    passiv.up();
    balans.up();

    dokument.ele('Пояснения').att('НаимФайлПЗ', '').up();
    dokument.up();
    doc.up();

    return doc.end({ prettyPrint: false });
  }
}

/**
 * Маппинг пользовательского display-id счёта («51», «80», «86.01») в
 * ledger2 numeric id-ы (со смещением *1000). Сложный subaccount формат
 * «86.01» становится 861000.
 */
function ledger2DisplayIdToLedgerIds(displayId: string): number[] {
  const trimmed = displayId.trim();
  if (!trimmed) return [];
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return [];
  const integer = match[1];
  const subaccount = match[2];
  if (subaccount) {
    return [Number.parseInt(integer + subaccount, 10) * 1000];
  }
  return [Number.parseInt(integer, 10) * 1000];
}
