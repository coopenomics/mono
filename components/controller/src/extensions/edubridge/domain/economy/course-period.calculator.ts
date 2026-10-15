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
import { eduMonthSeconds } from './time-scale';


export interface CoursePeriod {
  /** Сколько месяцев оплачивает взнос; неполный последний считается месяцем. */
  months: number;
  /** День, которым заканчивается курс и оплаченный срок. */
  paid_until: Date;
}

/** Месяц сроков и программ — четыре недели: в 28 днях каждого дня недели ровно четыре, занятия по окнам и оплаченные минуты сходятся. */
export const MONTH_DAYS = 28;

/**
 * Дата плюс месяцы по четыре недели — так же, как считает контракт
 * (`Edubridge::add_months`). Календарная длина месяца не учитывается.
 */
export function addMonths(date: Date, months: number): Date {
  // Стенд разработки со сжатым временем: месяц — заданное число секунд, как в условиях группы в цепи.
  const monthSeconds = eduMonthSeconds();
  const len = monthSeconds > 0 ? monthSeconds : MONTH_DAYS * 24 * 60 * 60;
  return new Date(date.getTime() + months * len * 1000);
}

/**
 * Оплаченный срок помесячного взноса — как его считает контракт: месяц от
 * `from`, но не раньше начала занятий, и не дальше конца программы.
 *
 * @param startsAt начало занятий; `null` — не назначено, месяц идёт от `from`
 * @param courseMonths длительность программы в месяцах; 0 — программа без конца
 * @returns `null`, когда оплачивать нечего: программа закончилась либо оплачена до конца;
 *   `partial` — месяц неполный, последний в программе
 */
export function monthPeriod(startsAt: Date | null, courseMonths: number, from: Date): (CoursePeriod & { partial: boolean }) | null {
  const start = startsAt ?? from;
  const base = from > start ? from : start;
  const paidUntil = addMonths(base, 1);
  if (!startsAt || !(courseMonths > 0)) return { months: 1, paid_until: paidUntil, partial: false };
  const end = addMonths(start, courseMonths);
  if (base >= end) return null;
  // Месяц обрезан концом программы — последний неполный: взнос идёт по остатку занятий.
  return paidUntil > end ? { months: 1, paid_until: end, partial: true } : { months: 1, paid_until: paidUntil, partial: false };
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
