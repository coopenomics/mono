/**
 * Расчёт членского взноса за курс. Стоимость складывается снизу: часы занятий
 * по ставке преподавателя дают себестоимость, кооператив добавляет наценку.
 * Взнос вносят помесячно либо разом за весь курс: курс длится столько месяцев,
 * сколько занимает его программа, и за взнос разом кооператив даёт скидку.
 * Скидка ограничена наценкой: ниже себестоимости взнос не опускается.
 *
 * Единственный источник арифметики взносов — и сервер, и стол считают здесь.
 */

/** Знаков после запятой в сумме цепи. */
const PRECISION = 4;
const SCALE = 10 ** PRECISION;


export interface CourseFeeParams {
  /** Минут занятий в месяц по окнам расписания. */
  minutes_per_month: number;
  /** Оплата занятий месяца одним участником по стоимости окон («8666.6667 RUB»). */
  teach_month: string;
  /** Наценка кооператива, проценты. */
  markup_percent: number;
  /** Длительность программы в месяцах с шагом в неделю (0,25); ноль — курс без конечной программы. */
  program_months: number;
  /** Скидка за взнос разом за весь курс, проценты. */
  course_discount_percent: number;
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
  /** Длительность курса в месяцах; ноль — курс без конечной программы. */
  course_months: number;
  /** Сумма помесячных взносов за весь курс — взнос за курс до скидки. */
  fee_course_base: string;
  /** Скидка за взнос разом в сумме. */
  course_discount_amount: string;
  /** Членский взнос за весь курс разом. */
  fee_course: string;
  /** Себестоимость курса — ниже неё взнос разом опускаться не может. */
  cost_course: string;
  /** Предельная скидка, при которой взнос за курс равен себестоимости, проценты. */
  max_course_discount_percent: number;
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
 * Скидка съедает наценку: при доле наценки в взносе `m / (100 + m)` взнос за
 * курс со скидкой ровно в эту долю равен себестоимости. Предел — целое число
 * процентов, округление вниз: дробный предел («до 23,07%») администратор не
 * читает, а округлённое вниз значение само проверку проходит.
 */
export function maxCourseDiscountPercent(markupPercent: number): number {
  if (markupPercent <= 0) return 0;
  return Math.floor((markupPercent / (100 + markupPercent)) * 100);
}

export interface FeeForMonths {
  /** Сумма помесячных взносов за эти месяцы. */
  base: string;
  /** Скидка в сумме. */
  discount: string;
  /** Взнос к уплате. */
  amount: string;
}

/**
 * Взнос разом за несколько месяцев курса. Участник, пришедший в середине,
 * вносит за оставшиеся месяцы — скидка та же, считается от их суммы.
 */
export function feeForMonths(feeMonth: string, months: number, discountPercent: number): FeeForMonths {
  const { amount, symbol } = parseAmount(feeMonth);
  // Месяцы — с шагом в неделю (четверть месяца): неполный месяц оплачивается долей месячного взноса, нацело.
  const weeks = Math.max(0, Math.round(months * WEEKS_IN_MONTH));
  const base = Number((BigInt(amount) * BigInt(weeks)) / BigInt(WEEKS_IN_MONTH));
  return withDiscount(base, discountPercent, symbol);
}

/** Недель в месяце: месяц сроков и программ — четыре недели. */
const WEEKS_IN_MONTH = 4;

/** Скидка от суммы: деление нацело по сотым долям процента — как в контракте (`Edubridge::quote_fee`). */
function withDiscount(base: number, discountPercent: number, symbol: string): FeeForMonths {
  const discount = Math.floor((base * Math.round(discountPercent * 100)) / 10000);
  return { base: formatAmount(base, symbol), discount: formatAmount(discount, symbol), amount: formatAmount(base - discount, symbol) };
}

/**
 * Взнос за минуты занятий — доля месячного взноса: неполный последний месяц и
 * остаток программы. Деление нацело — как в контракте (`Edubridge::quote_fee`).
 */
export function feeForMinutes(feeMonth: string, minutes: number, minutesPerMonth: number, discountPercent = 0): FeeForMonths {
  const { amount, symbol } = parseAmount(feeMonth);
  const base = minutesPerMonth > 0 ? Number((BigInt(amount) * BigInt(Math.max(0, minutes))) / BigInt(minutesPerMonth)) : 0;
  return withDiscount(base, discountPercent, symbol);
}

/**
 * Взнос за срок — как считает контракт: за оплаченные минуты. Минут меньше,
 * чем в полных месяцах срока (остаток программы, неполный месяц), — доля
 * месячного взноса по минутам; иначе месячный взнос на число месяцев.
 */
export function feeForPeriod(feeMonth: string, months: number, minutes: number, minutesPerMonth: number, discountPercent = 0): FeeForMonths {
  if (minutes < minutesPerMonth * months) return feeForMinutes(feeMonth, minutes, minutesPerMonth, discountPercent);
  return feeForMonths(feeMonth, months, discountPercent);
}

/** Стоимость часов по ставке — общий множитель себестоимости. */
export function costOfHours(hourlyRate: string, hours: number): string {
  const { amount, symbol } = parseAmount(hourlyRate);
  return formatAmount(Math.round(amount * round2(hours)), symbol);
}

export function calculateCourseFee(params: CourseFeeParams): CourseFeeCalculation {
  const { amount: costMonth, symbol } = parseAmount(params.teach_month);
  const minutes = Math.max(0, Math.floor(params.minutes_per_month || 0));
  // Часы — только для показа: себестоимость месяца приходит суммой стоимостей окон, как считает контракт.
  const hoursPerMonth = round2(minutes / 60);
  const markupMonth = Math.round((costMonth * params.markup_percent) / 100);
  const feeMonth = costMonth + markupMonth;

  // Длительность — с шагом в неделю: 3,5 месяца — три месяца и две недели.
  const months = Math.max(0, Math.round(Number(params.program_months || 0) * WEEKS_IN_MONTH) / WEEKS_IN_MONTH);
  const course = feeForMonths(formatAmount(feeMonth, symbol), months, params.course_discount_percent);

  return {
    hours_per_month: hoursPerMonth,
    cost_month: formatAmount(costMonth, symbol),
    markup_month: formatAmount(markupMonth, symbol),
    fee_month: formatAmount(feeMonth, symbol),
    course_months: months,
    fee_course_base: course.base,
    course_discount_amount: course.discount,
    fee_course: course.amount,
    cost_course: formatAmount(Math.floor(costMonth * months), symbol),
    max_course_discount_percent: maxCourseDiscountPercent(params.markup_percent),
  };
}

/** Часы округляются до сотых: расписание задаётся получасами, а не долями секунды. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
