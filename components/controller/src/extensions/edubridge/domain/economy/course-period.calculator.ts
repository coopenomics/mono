/**
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

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
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
