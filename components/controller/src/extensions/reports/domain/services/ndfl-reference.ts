import { getJurisdiction, getPersonalIncomeTax } from '@coopenomics/jurisdictions';
import type { JurisdictionProfile, PersonalIncomeTax } from '@coopenomics/jurisdictions';

/**
 * Параметры НДФЛ для форм отчётности — ставка, КБК, код вида дохода и
 * часовой пояс, по которому определяются сроки перечисления.
 *
 * Юрисдикция здесь российская не потому, что так удобно, а потому что сами
 * формы российские: 6-НДФЛ и уведомление об исчисленных суммах существуют
 * только в контуре ФНС и валидируются её XSD. Кооператив другой страны сдаёт
 * другие формы, а не эти же с другим КБК, — поэтому страну кооператива тут не
 * спрашивают.
 *
 * Значения берутся на отчётный год, а не «на сегодня»: при смене ставки или
 * КБК прошлогодний отчёт обязан пересобраться таким же, каким его сдавали.
 */

const RUSSIA = 'Russia';

/** Профиль российской юрисдикции — форма без него не строится. */
function russianProfile(): JurisdictionProfile {
  const profile = getJurisdiction(RUSSIA);
  if (!profile) throw new Error('Справочник российской юрисдикции недоступен');
  return profile;
}

/**
 * Ставка и коды НДФЛ, действовавшие в отчётном году.
 *
 * Форма 6-НДФЛ версии 5.05 введена приказом ФНС от 18.10.2024 № ЕД-7-11/877@ и
 * применяется с отчётности за 2025 год, поэтому за более ранние годы
 * справочник данных не содержит — и это отказ, а не повод подставить
 * сегодняшние значения в прошлогодний отчёт.
 */
export function getNdflParams(reportYear: number): PersonalIncomeTax {
  const params = getPersonalIncomeTax(RUSSIA, `${reportYear}-12-31`);
  if (!params) {
    throw new Error(
      `Параметры НДФЛ за ${reportYear} год неизвестны: форма применяется с отчётности за 2025 год`
    );
  }
  return params;
}

/**
 * Смещение часового пояса, по которому определяются налоговые сроки, в
 * минутах от UTC. Блокчейн штампует блоки в UTC, а срок перечисления считается
 * по местному времени: выплата в 23:30 UTC 22-го числа произошла уже 23-го по
 * Москве и попадает в следующий срок.
 */
export function getTaxTimezoneOffsetMinutes(): number {
  return russianProfile().taxTimezoneOffsetMinutes;
}

/** Год, месяц и день события в том поясе, по которому считаются налоговые сроки. */
export interface TaxDateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Разложить момент времени на дату по налоговому поясу.
 *
 * Считать по UTC нельзя: и попадание выплаты в расчётный период, и срок
 * перечисления определяются местной датой, а разница с UTC переносит событие
 * через границу периода.
 */
export function toTaxDateParts(date: Date): TaxDateParts {
  const shifted = new Date(date.getTime() + getTaxTimezoneOffsetMinutes() * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}
