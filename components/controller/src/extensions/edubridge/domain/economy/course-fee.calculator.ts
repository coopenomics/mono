/**
 * Расчёт членского взноса за курс. Стоимость складывается снизу: часы занятий
 * по ставке преподавателя дают себестоимость, кооператив добавляет наценку.
 * Годовой взнос — месячный за двенадцать месяцев со скидкой за объём, и скидка
 * ограничена наценкой: ниже себестоимости взнос не опускается.
 *
 * Единственный источник арифметики взносов — и сервер, и стол считают здесь.
 */

/** Знаков после запятой в сумме цепи. */
const PRECISION = 4;
const SCALE = 10 ** PRECISION;

/** Месяцев в годовой подписке. */
export const MONTHS_IN_YEAR = 12;

export interface CourseFeeParams {
  /** Занятий в месяц по расписанию курса. */
  lessons_per_month: number;
  /** Часов в одном занятии. */
  lesson_hours: number;
  /** Ставка часа, по которой считается себестоимость («1000.0000 RUB»). */
  hourly_rate: string;
  /** Наценка кооператива, проценты. */
  markup_percent: number;
  /** Скидка за годовой объём, проценты. */
  year_discount_percent: number;
}

export interface CourseFeeCalculation {
  /** Часов занятий в месяц. */
  hours_per_month: number;
  /** Себестоимость месяца — часы по ставке. */
  cost_month: string;
  /** Наценка кооператива в сумме за месяц. */
  markup_month: string;
  /** Членский взнос за месяц. */
  fee_month: string;
  /** Взнос за год до скидки — месячный за двенадцать месяцев. */
  fee_year_base: string;
  /** Скидка за годовой объём в сумме. */
  year_discount_amount: string;
  /** Членский взнос за год. */
  fee_year: string;
  /** Себестоимость года — ниже неё годовой взнос опускаться не может. */
  cost_year: string;
  /** Предельная скидка, при которой годовой взнос равен себестоимости, проценты. */
  max_year_discount_percent: number;
}

function parseAmount(asset: string): { amount: number; symbol: string } {
  const match = String(asset ?? '').trim().match(/^(\d+(?:\.\d+)?)\s+([A-Z]{1,7})$/);
  if (!match) return { amount: 0, symbol: '' };
  return { amount: Math.round(Number(match[1]) * SCALE), symbol: match[2] };
}

function formatAmount(minor: number, symbol: string): string {
  return `${(minor / SCALE).toFixed(PRECISION)} ${symbol}`;
}

/**
 * Скидка съедает наценку: при доле наценки в взносе `m / (100 + m)` годовой
 * взнос со скидкой ровно в эту долю равен себестоимости. Округление вниз до
 * сотых процента — чтобы предельное значение само проверку проходило.
 */
export function maxYearDiscountPercent(markupPercent: number): number {
  if (markupPercent <= 0) return 0;
  return Math.floor(((markupPercent / (100 + markupPercent)) * 100) * 100) / 100;
}

/** Стоимость часов по ставке — общий множитель себестоимости. */
export function costOfHours(hourlyRate: string, hours: number): string {
  const { amount, symbol } = parseAmount(hourlyRate);
  return formatAmount(Math.round(amount * round2(hours)), symbol);
}

export function calculateCourseFee(params: CourseFeeParams): CourseFeeCalculation {
  const { amount: rate, symbol } = parseAmount(params.hourly_rate);
  const hoursPerMonth = round2(params.lessons_per_month * params.lesson_hours);

  const costMonth = Math.round(rate * hoursPerMonth);
  const markupMonth = Math.round((costMonth * params.markup_percent) / 100);
  const feeMonth = costMonth + markupMonth;

  const feeYearBase = feeMonth * MONTHS_IN_YEAR;
  const discountAmount = Math.round((feeYearBase * params.year_discount_percent) / 100);
  const feeYear = feeYearBase - discountAmount;
  const costYear = costMonth * MONTHS_IN_YEAR;

  return {
    hours_per_month: hoursPerMonth,
    cost_month: formatAmount(costMonth, symbol),
    markup_month: formatAmount(markupMonth, symbol),
    fee_month: formatAmount(feeMonth, symbol),
    fee_year_base: formatAmount(feeYearBase, symbol),
    year_discount_amount: formatAmount(discountAmount, symbol),
    fee_year: formatAmount(feeYear, symbol),
    cost_year: formatAmount(costYear, symbol),
    max_year_discount_percent: maxYearDiscountPercent(params.markup_percent),
  };
}

/** Часы округляются до сотых: расписание задаётся получасами, а не долями секунды. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
