/**
 * Предварительный срок оплаты — для показа участнику до взноса. Срок считает
 * и записывает контракт (`edubridge::chargefee`); после взноса приложение
 * читает его из цепи.
 *
 * Срок, который оплачивает взнос за весь курс разом. Курс длится столько
 * месяцев, сколько занимает программа, и заканчивается в один день для всех:
 * участник, пришедший в середине, вносит взнос за оставшиеся месяцы, а не за
 * всю программу заново. То же при переходе с помесячного взноса — оплаченный
 * месяц засчитывается, взнос разом идёт за остаток.
 */

export interface CoursePeriod {
  /** Сколько месяцев оплачивает взнос; неполный последний считается месяцем. */
  months: number;
  /** День, которым заканчивается курс и оплаченный срок. */
  paid_until: Date;
}

/**
 * Дата плюс календарные месяцы — так же, как считает контракт
 * (`Edubridge::add_months`): числа, которого в месяце нет, не бывает,
 * 31 января плюс месяц — последний день февраля.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

/**
 * @param startsAt день начала занятий; `null` — день не назначен, курс отсчитывается от `from`
 * @param courseMonths длительность курса в месяцах
 * @param from с какого дня идёт новый оплаченный срок: сегодня либо конец уже оплаченного
 * @returns `null`, когда оплачивать нечего: программа закончилась либо оплачена до конца
 */
export function remainingCoursePeriod(startsAt: Date | null, courseMonths: number, from: Date): CoursePeriod | null {
  if (!(courseMonths > 0)) return null;
  const start = startsAt ?? from;
  const end = addMonths(start, courseMonths);
  const base = from > start ? from : start;
  if (base >= end) return null;
  let months = 1;
  while (months < courseMonths && addMonths(base, months) < end) months += 1;
  return { months, paid_until: end };
}
