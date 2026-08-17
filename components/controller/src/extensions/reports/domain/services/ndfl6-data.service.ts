import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  INDIVIDUAL_PORT,
  LEDGER2_HISTORY_PORT,
  type IIndividualPort,
  type ILedger2HistoryPort,
  type InnerIndividual,
  type InnerLedger2Operation,
} from '@coopenomics/innercoop';
import { uvNdflPeriodOf } from '../enums/report-type.enum';
import { getNdflParams, getTaxTimezoneOffsetMinutes } from './ndfl-reference';
import {
  type Ndfl6CertificateShape,
  type Ndfl6MonthlyIncomeShape,
  type Ndfl6TaxShape,
} from '../edits-shapes/ndfl6-edits.shape';

/**
 * Считает 6-НДФЛ по данным ledger2. Единственный источник дохода, с которого
 * кооператив удерживает налог, — материальная помощь доверенному лицу
 * кооперативного участка (процесс `p.brn.aid`), поэтому обе нужные операции
 * лежат в одном месте:
 *
 *   `o.brn.aid`    — выплата на руки (BURN `w.brn.person`, Дт 86 / Кт 51);
 *   `o.brn.aidtax` — удержанный налог (TRANSFER в `w.brn.ndfl`, Дт 86 / Кт 68).
 *
 * Обе проводятся одной транзакцией при подтверждении кассиром и несут общий
 * `processHash` (хэш заявления), поэтому доход до удержания восстанавливается
 * их сложением — делить налог на ставку не нужно, и копейка не теряется даже
 * там, где округление до полного рубля сместило налог.
 *
 * Третья операция процесса, `o.brn.taxpay` (перечисление в бюджет), в расчёт
 * не входит: 6-НДФЛ показывает исчисленное и удержанное, а не то, дошли ли
 * деньги до бюджета.
 */

/** Код статуса: 1 — налогоплательщик является налоговым резидентом РФ. */
const TAXPAYER_STATUS_RESIDENT = '1';
/** Код страны по ОКСМ: 643 — Российская Федерация. */
const CITIZENSHIP_RUSSIA = '643';
/** Код вида документа: 21 — паспорт гражданина Российской Федерации. */
const DOCUMENT_TYPE_PASSPORT_RF = '21';

const AID_OPERATION = 'o.brn.aid';
const AID_TAX_OPERATION = 'o.brn.aidtax';

/** Одна выплата: доход получателя и удержанный из него налог. */
interface AidPayout {
  username: string;
  /** Доход до удержания, в копейках. */
  grossMinor: number;
  /** Удержанный налог, целые рубли. */
  taxRub: number;
  /** Месяц выплаты по московскому времени, 1..12. */
  month: number;
  /** День месяца по московскому времени, 1..31. */
  day: number;
}

interface MoscowDateParts {
  year: number;
  month: number;
  day: number;
}

@Injectable()
export class Ndfl6DataService {
  private readonly logger = new Logger(Ndfl6DataService.name);

  constructor(
    @Inject(LEDGER2_HISTORY_PORT) private readonly ledger2Service: ILedger2HistoryPort,
    @Inject(INDIVIDUAL_PORT)
    private readonly individualRepo: IIndividualPort,
  ) {}

  /**
   * Собрать разделы 1 и 2 отчёта за период «с начала года по конец квартала».
   *
   * @param quarter отчётный квартал 1..4 — определяет и границу нарастающего
   *   итога, и то, какие три месяца попадут в разбивку по срокам.
   */
  async buildTaxSection(coopname: string, year: number, quarter: number): Promise<Ndfl6TaxShape> {
    const payouts = await this.collectPayouts(coopname, year, quarter);
    return this.aggregate(payouts, quarter);
  }

  /**
   * Налог, удержанный за один расчётный период месяца, — сумма для
   * уведомления об исчисленных суммах.
   *
   * Уведомление по НДФЛ подаётся дважды в месяц, и границей служит 22-е число:
   * удержанное с 1 по 22 перечисляется до 28 числа того же месяца, удержанное
   * с 23 по последнее — до 5 числа следующего. Ровно та же граница делит
   * шесть сроков в разделе 1 формы 6-НДФЛ, поэтому суммы двух документов
   * сходятся по построению.
   *
   * @param secondHalf false — период с 1 по 22 число, true — с 23 по последнее.
   */
  async buildNotificationAmount(
    coopname: string,
    year: number,
    month: number,
    secondHalf: boolean,
  ): Promise<number> {
    const amounts = await this.buildNotificationAmounts(coopname, year);
    return amounts.get(uvNdflPeriodOf(month, secondHalf)) ?? 0;
  }

  /**
   * Удержанный налог по всем расчётным периодам года: ключ — сквозной номер
   * периода 1..24, значение — сумма в рублях. Периодов без удержаний в карте
   * нет: за них уведомление не подаётся.
   *
   * Календарю отчётности нужны сразу все периоды, поэтому считаем их одним
   * проходом — двадцать четыре отдельных запроса к истории ledger2 ради
   * одной строки каждый были бы расточительством.
   */
  async buildNotificationAmounts(coopname: string, year: number): Promise<Map<number, number>> {
    const payouts = await this.collectPayouts(coopname, year, 4);
    const byPeriod = new Map<number, number>();
    for (const p of payouts) {
      if (p.taxRub === 0) continue;
      const period = uvNdflPeriodOf(p.month, p.day > 22);
      byPeriod.set(period, (byPeriod.get(period) ?? 0) + p.taxRub);
    }
    return byPeriod;
  }

  /**
   * Собрать справки о доходах за год — приложение № 1. Одна справка на
   * получателя, с помесячной разбивкой дохода.
   *
   * Персональные данные берутся из профиля пайщика. Паспорт формально
   * необязателен, но у получателей матпомощи он есть по построению: его
   * собирают, когда доверенное лицо участка подписывает договор материальной
   * ответственности, а получить матпомощь может только доверенное лицо.
   * Если паспорта всё же нет, справка выпускается с пустым документом —
   * бухгалтер увидит это в форме и дозаполнит, а не получит молча битый XML.
   */
  async buildCertificates(coopname: string, year: number): Promise<Ndfl6CertificateShape[]> {
    const payouts = await this.collectPayouts(coopname, year, 4);
    if (payouts.length === 0) return [];

    const byUsername = new Map<string, AidPayout[]>();
    for (const p of payouts) {
      const list = byUsername.get(p.username);
      if (list) list.push(p);
      else byUsername.set(p.username, [p]);
    }

    const certificates: Ndfl6CertificateShape[] = [];
    let number = 1;
    // Порядок справок — по имени аккаунта: номера справок должны быть
    // устойчивы между пересборками отчёта, иначе корректировка сошлётся
    // не на ту справку.
    for (const username of [...byUsername.keys()].sort()) {
      const list = byUsername.get(username) ?? [];
      const individual = await this.findIndividual(username);
      certificates.push(this.buildCertificate(username, number, list, individual, year));
      number += 1;
    }
    return certificates;
  }

  /** Выплаты за период с 1 января по конец указанного квартала. */
  private async collectPayouts(
    coopname: string,
    year: number,
    quarter: number,
  ): Promise<AidPayout[]> {
    const operations = await this.fetchOperations(coopname, year);
    const taxByHash = this.indexTaxByHash(operations);
    const lastMonth = quarter * 3;

    const payouts: AidPayout[] = [];
    for (const op of operations) {
      if (op.operationCode !== AID_OPERATION) continue;
      const payout = this.toPayout(op, taxByHash, year, lastMonth);
      if (payout) payouts.push(payout);
    }
    return payouts;
  }

  /**
   * Удержания по хэшу заявления. Налог лежит отдельной проводкой и
   * подтягивается к выплате: выплата есть всегда, а удержания может не быть —
   * при сумме меньше рубля налог округляется в ноль, и контракт проводку не
   * делает.
   */
  private indexTaxByHash(operations: InnerLedger2Operation[]): Map<string, number> {
    const taxByHash = new Map<string, number>();
    for (const op of operations) {
      if (op.operationCode !== AID_TAX_OPERATION || !op.processHash) continue;
      const rub = this.parseAmount(op.quantity);
      taxByHash.set(op.processHash, (taxByHash.get(op.processHash) ?? 0) + rub);
    }
    return taxByHash;
  }

  /** Выплата в отчётном периоде, или null — если она вне периода. */
  private toPayout(
    op: InnerLedger2Operation,
    taxByHash: Map<string, number>,
    year: number,
    lastMonth: number,
  ): AidPayout | null {
    if (!op.username) {
      this.logger.warn(
        `Операция ${AID_OPERATION} (${op.globalSequence}) без получателя — пропущена в 6-НДФЛ`,
      );
      return null;
    }
    const parts = this.toMoscowParts(op.createdAt);
    if (parts.year !== year || parts.month > lastMonth) return null;

    const netRub = this.parseAmount(op.quantity);
    const taxRub = op.processHash ? (taxByHash.get(op.processHash) ?? 0) : 0;
    return {
      username: op.username,
      grossMinor: this.toMinor(netRub) + this.toMinor(taxRub),
      taxRub,
      month: parts.month,
      day: parts.day,
    };
  }

  /** Все операции матпомощи за год — постранично, лимит выдачи 500. */
  private async fetchOperations(coopname: string, year: number): Promise<InnerLedger2Operation[]> {
    // Границы берём с запасом в сутки с обеих сторон: запрос идёт по UTC, а
    // отбор — по московским датам, и выплата 1 января 00:30 MSK лежит в UTC
    // ещё в прошлом году. Лишнее отсекает фильтр по `toMoscowParts`.
    const dateFrom = new Date(Date.UTC(year - 1, 11, 31, 0, 0, 0));
    const dateTo = new Date(Date.UTC(year + 1, 0, 2, 0, 0, 0));

    const items: InnerLedger2Operation[] = [];
    const limit = 500;
    let page = 1;
    for (;;) {
      const response = await this.ledger2Service.getHistory({
        coopname,
        actionNames: ['apply'],
        operationCodes: [AID_OPERATION, AID_TAX_OPERATION],
        dateFrom,
        dateTo,
        page,
        limit,
        sortOrder: 'ASC',
      });
      items.push(...response.items);
      if (page >= response.totalPages || response.items.length === 0) break;
      page += 1;
    }
    return items;
  }

  private aggregate(payouts: AidPayout[], quarter: number): Ndfl6TaxShape {
    const firstMonthOfQuarter = (quarter - 1) * 3 + 1;
    const byTerm: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

    let incomeMinor = 0;
    let taxTotal = 0;
    const people = new Set<string>();

    for (const p of payouts) {
      incomeMinor += p.grossMinor;
      taxTotal += p.taxRub;
      people.add(p.username);

      // Шесть сроков — только последний квартал отчётного периода: на бланке
      // строки 021–026 и 161–166 идут под «в том числе». Нарастающий итог с
      // начала года остаётся в строках 020 и 160.
      const monthInQuarter = p.month - firstMonthOfQuarter;
      if (monthInQuarter < 0 || monthInQuarter > 2) continue;
      const termIndex = monthInQuarter * 2 + (p.day <= 22 ? 0 : 1);
      byTerm[termIndex] += p.taxRub;
    }

    const incomeTotal = this.fromMinor(incomeMinor);
    return {
      peopleCount: people.size,
      incomeTotal,
      // Вычеты не применяются: получатель матпомощи не работник кооператива,
      // освобождение первых 4 000 ₽ по п. 28 ст. 217 НК к нему не относится.
      deductionsTotal: 0,
      taxBase: incomeTotal,
      taxCalculated: taxTotal,
      // Налог удерживается в момент выплаты, поэтому исчисленный и удержанный
      // всегда совпадают: неудержанного остатка у кооператива не возникает.
      withheldTotal: taxTotal,
      byTerm,
    };
  }

  private buildCertificate(
    username: string,
    number: number,
    payouts: AidPayout[],
    individual: InnerIndividual | null,
    year: number,
  ): Ndfl6CertificateShape {
    const monthlyMinor = new Map<number, number>();
    let incomeMinor = 0;
    let taxTotal = 0;
    for (const p of payouts) {
      incomeMinor += p.grossMinor;
      taxTotal += p.taxRub;
      monthlyMinor.set(p.month, (monthlyMinor.get(p.month) ?? 0) + p.grossMinor);
    }

    // Код вида дохода берётся на отчётный год: справка за прошлый год должна
    // пересобраться такой же, какой её сдавали.
    const incomeCode = getNdflParams(year).aidIncomeCode;
    const monthlyIncome: Ndfl6MonthlyIncomeShape[] = [...monthlyMinor.keys()]
      .sort((a, b) => a - b)
      .map((month) => ({
        month,
        incomeCode,
        amount: this.fromMinor(monthlyMinor.get(month) ?? 0),
      }));

    const incomeTotal = this.fromMinor(incomeMinor);
    return {
      username,
      number,
      // «00» — первичная справка. Корректирующую бухгалтер выставляет руками.
      correctionNumber: '00',
      lastName: individual?.last_name ?? '',
      firstName: individual?.first_name ?? '',
      middleName: individual?.middle_name || null,
      birthDate: this.formatBirthDate(individual?.birthdate),
      taxpayerStatus: TAXPAYER_STATUS_RESIDENT,
      citizenshipCode: CITIZENSHIP_RUSSIA,
      documentTypeCode: DOCUMENT_TYPE_PASSPORT_RF,
      documentSerialNumber: this.formatPassport(individual),
      incomeTotal,
      taxBase: incomeTotal,
      taxCalculated: taxTotal,
      taxWithheld: taxTotal,
      monthlyIncome,
    };
  }

  private async findIndividual(username: string): Promise<InnerIndividual | null> {
    try {
      return await this.individualRepo.findByUsername(username);
    } catch (e) {
      // Профиль может не найтись, если пайщик заведён вне обычного потока.
      // Отчёт не роняем: справка выйдет с пустыми полями, бухгалтер увидит
      // пробел в форме до отправки в ФНС.
      this.logger.warn(
        `Не найдены персональные данные получателя ${username} для справки 6-НДФЛ: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return null;
    }
  }

  /**
   * Серия и номер паспорта одной строкой — схема их не разделяет. Оба поля
   * хранятся числами, поэтому ведущие нули приходится восстанавливать:
   * серия «0405» лежит в базе как 405 и без дополнения превратилась бы в
   * несуществующий документ.
   */
  private formatPassport(individual: InnerIndividual | null): string {
    const passport = individual?.passport;
    if (!passport) return '';
    const series = String(passport.series ?? '').padStart(4, '0');
    const number = String(passport.number ?? '').padStart(6, '0');
    return `${series} ${number}`;
  }

  /** Дата рождения хранится как `ГГГГ/ММ/ДД`, а ФНС ждёт `ДД.ММ.ГГГГ`. */
  private formatBirthDate(birthdate: string | undefined): string {
    if (!birthdate) return '';
    const match = birthdate.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
    if (!match) return '';
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  private toMoscowParts(date: Date): MoscowDateParts {
    const shifted = new Date(date.getTime() + getTaxTimezoneOffsetMinutes() * 60_000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    };
  }

  /** Asset вида «10000.0000 RUB» → 10000. */
  private parseAmount(quantity: string | null | undefined): number {
    if (!quantity) return 0;
    const match = quantity.match(/(-?\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  private toMinor(rub: number): number {
    return Math.round(rub * 100);
  }

  private fromMinor(minor: number): number {
    return minor / 100;
  }
}
