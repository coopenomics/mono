/**
 * Расчёт возврата членского взноса при отмене подписки по Положению ЦПП
 * «Образование».
 *
 * Три основания и три суммы. До активации курса ученик получает стоимость
 * целиком: обучение не началось. Кооператив, не набравший группу, отменяет
 * курс — тоже целиком, и сразу на паевой: это отмена его собственного решения.
 * Отказ в ходе подписки возвращает половину остаточной стоимости: использованное
 * остаётся кооперативу полностью, неиспользованное делится пополам.
 *
 * Использованное считается по занятиям: сколько их прошло с активации курса по
 * его расписанию. Журнала проведённых занятий пока нет, поэтому счёт идёт по
 * плану курса — когда журнал появится, здесь встанет факт.
 */

const PRECISION = 4;
const SCALE = 10 ** PRECISION;
const MONTHS_IN_YEAR = 12;
/** Дней в учебном месяце — по нему считается, сколько занятий прошло. */
const DAYS_IN_MONTH = 30;

/** Основание возврата — от него зависит и сумма, и куда она идёт. */
export enum RefundReason {
  /** Ученик отменил подписку до активации курса. */
  BEFORE_START = 'before_start',
  /** Кооператив отменил курс по недобору. */
  UNDERFILLED = 'underfilled',
  /** Ученик отказался в ходе подписки. */
  REFUSAL = 'refusal',
}

export interface RefundParams {
  /** Уплаченный взнос за период («9600.0000 RUB»). */
  paid_amount: string;
  /** Занятий в месяц по расписанию курса. */
  lessons_per_month: number;
  /** Занятий во всей программе курса. */
  lessons_total: number;
  /** Сколько месяцев оплачено взносом: один при помесячном, месяцы курса при взносе разом. */
  months_paid: number;
  /** С какого дня идёт оплаченный срок. Участник, пришедший в середине курса,
   *  платил за оставшиеся месяцы — занятия до этого дня ему не засчитываются. */
  paid_from?: Date | null;
  /** Дата активации курса; `null` — курс ещё не активирован. */
  starts_at: Date | null;
  /** Момент отмены. */
  now: Date;
  /** Отмена по недобору кооператива. */
  underfilled?: boolean;
}

export interface RefundCalculation {
  reason: RefundReason;
  /** Сколько возвращается ученику. */
  refund: string;
  /** Сколько остаётся в фонде программы. */
  withheld: string;
  /** Занятий оплачено периодом. */
  lessons_paid: number;
  /** Занятий прошло к моменту отмены. */
  lessons_used: number;
  /** Возврат идёт сразу на паевой (отмена решения кооператива). */
  to_share: boolean;
}

export function calculateRefund(params: RefundParams): RefundCalculation {
  const { amount: paidMinor, symbol } = parseAmount(params.paid_amount);
  const lessonsPaid = Math.max(
    0,
    Math.min(params.lessons_per_month * Math.max(1, params.months_paid), params.lessons_total || Number.MAX_SAFE_INTEGER)
  );
  const lessonsUsed = lessonsDone(params, lessonsPaid);

  // Недобор — отмена решения кооператива: занятия не начинались, взнос
  // возвращается целиком и сразу в паевой, заявления от ученика не требуется.
  if (params.underfilled) {
    return {
      reason: RefundReason.UNDERFILLED,
      refund: formatAmount(paidMinor, symbol),
      withheld: formatAmount(0, symbol),
      lessons_paid: lessonsPaid,
      lessons_used: lessonsUsed,
      to_share: true,
    };
  }

  if (!params.starts_at || params.now < params.starts_at) {
    return {
      reason: RefundReason.BEFORE_START,
      refund: formatAmount(paidMinor, symbol),
      withheld: formatAmount(0, symbol),
      lessons_paid: lessonsPaid,
      lessons_used: 0,
      to_share: false,
    };
  }

  const remainingMinor = lessonsPaid > 0 ? Math.round((paidMinor * (lessonsPaid - lessonsUsed)) / lessonsPaid) : 0;
  const refundMinor = Math.floor(remainingMinor / 2);

  return {
    reason: RefundReason.REFUSAL,
    refund: formatAmount(refundMinor, symbol),
    withheld: formatAmount(paidMinor - refundMinor, symbol),
    lessons_paid: lessonsPaid,
    lessons_used: lessonsUsed,
    to_share: false,
  };
}

/** Сколько занятий прошло с активации курса — но не больше оплаченных. */
function lessonsDone(params: RefundParams, lessonsPaid: number): number {
  if (!params.starts_at || params.now <= params.starts_at) return 0;
  const from = params.paid_from && params.paid_from > params.starts_at ? params.paid_from : params.starts_at;
  if (params.now <= from) return 0;
  const days = (params.now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  const done = Math.floor((days / DAYS_IN_MONTH) * params.lessons_per_month);
  return Math.max(0, Math.min(done, lessonsPaid));
}

/**
 * Сколько месяцев оплачивает период подписки, открытой до появления взноса
 * за весь курс: у таких записей число оплаченных месяцев не сохранено.
 */
export function monthsOfPeriod(period: 'month' | 'year'): number {
  return period === 'year' ? MONTHS_IN_YEAR : 1;
}

function parseAmount(asset: string): { amount: number; symbol: string } {
  const match = String(asset ?? '').trim().match(/^(\d+(?:\.\d+)?)\s+([A-Z]{1,7})$/);
  if (!match) return { amount: 0, symbol: '' };
  return { amount: Math.round(Number(match[1]) * SCALE), symbol: match[2] };
}

function formatAmount(minor: number, symbol: string): string {
  return `${(minor / SCALE).toFixed(PRECISION)} ${symbol}`;
}
