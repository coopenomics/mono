/**
 * Сколько кооператив должен держать в резерве выплат преподавателям по курсу.
 *
 * Резерв считается от обязательств, а не от числа учеников: преподаватель
 * получает за проведённые часы по плановой ставке курса, сколько бы учеников на
 * них ни пришло. Поэтому резерв наполняется до стоимости часов за всё
 * оплаченное учениками время курса — за вычетом уже выплаченного
 * преподавателям, — а всё сверх этого остаётся свободными средствами программы.
 * На групповом курсе бюджет преподавателя закрывает первый взнос, остальные
 * свободны целиком.
 */

const PRECISION = 4;
const SCALE = 10 ** PRECISION;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface ReserveCourse {
  /** Себестоимость месяца курса — часы по плановой ставке («800.0000 RUB»). */
  cost_month: string;
  /** Длительность курса в месяцах; ноль — курс без конечной программы. */
  course_months: number;
  /** Дата начала занятий; `null` — курс ещё не активирован. */
  starts_at: Date | null;
}

/** Оплаченное учеником время курса. */
export interface ReserveCoverage {
  /** С какого дня ученик оплатил курс. */
  from: Date;
  /** До какого дня оплачено; у отменённой подписки — день отмены. */
  until: Date;
}

export interface ReserveState {
  /** Сколько сейчас лежит в резерве по этому курсу. */
  balance: string;
  /** Сколько преподавателям курса уже выплачено из резерва. */
  settled: string;
}

export interface ReserveTarget {
  /** Обязательство перед преподавателями за оплаченное время, ещё не выплаченное. */
  obligation: string;
  /** Сколько не хватает в резерве до обязательства. */
  gap: string;
  /** Сколько в резерве лежит сверх обязательства — возвращается в фонд. */
  surplus: string;
}

export function reserveTarget(course: ReserveCourse, coverage: ReserveCoverage[], state: ReserveState): ReserveTarget {
  const { amount: costMonth, symbol } = parse(course.cost_month);
  const total = Math.round(costMonth * coveredMonths(course, coverage));
  const obligation = Math.max(0, total - parse(state.settled).amount);
  const balance = parse(state.balance).amount;
  return {
    obligation: format(obligation, symbol),
    gap: format(Math.max(0, obligation - balance), symbol),
    surplus: format(Math.max(0, balance - obligation), symbol),
  };
}

/**
 * Оплаченное время курса — от самого раннего оплаченного дня (но не раньше
 * начала занятий) до самого позднего. Это время, а не сумма по ученикам:
 * занятие идёт одно на всех. У курса с конечной программой — не больше её длины.
 */
function coveredMonths(course: ReserveCourse, coverage: ReserveCoverage[]): number {
  if (!coverage.length) return 0;
  const earliest = Math.min(...coverage.map((c) => c.from.getTime()));
  const from = course.starts_at ? Math.max(earliest, course.starts_at.getTime()) : earliest;
  const until = Math.max(...coverage.map((c) => c.until.getTime()));
  const months = Math.max(0, (until - from) / MONTH_MS);
  return course.course_months > 0 ? Math.min(months, course.course_months) : months;
}

function parse(asset: string | null | undefined): { amount: number; symbol: string } {
  const match = String(asset ?? '').trim().match(/^(\d+(?:\.\d+)?)\s+([A-Z]{1,7})$/);
  if (!match) return { amount: 0, symbol: '' };
  return { amount: Math.round(Number(match[1]) * SCALE), symbol: match[2] };
}

function format(minor: number, symbol: string): string {
  return `${(minor / SCALE).toFixed(PRECISION)} ${symbol}`.trim();
}
