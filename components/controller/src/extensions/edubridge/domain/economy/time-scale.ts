/**
 * Шкала времени образования. В работе сутки и месяцы настоящие. На стенде
 * разработки время сжато, чтобы весь путь — набор, гарантийный срок, конец
 * оплаченного периода и завершение группы — проходился за минуты:
 * сутки — минута, месяц — десять таких суток (десять минут). Те же длины уходят в контракт
 * в условиях группы, поэтому сервер и цепь считают сроки одинаково.
 *
 *  - `NODE_ENV=production` (боевая и тестовая сеть) — сжатия нет никогда,
 *    переменные не действуют.
 *  - `NODE_ENV=development` — сжатие включено само собой.
 *  - `EDUBRIDGE_GUARANTEE_DAY_SECONDS` — своя длина суток (86400 — настоящие).
 *  - `EDUBRIDGE_MONTH_SECONDS` — своя длина месяца; 0 — календарные месяцы.
 */
const SECONDS_IN_DAY = 24 * 60 * 60;
/** Сутки на стенде разработки: одна минута. */
const DEV_SECONDS_IN_DAY = 60;
/** Суток в месяце сжатого времени. */
const DAYS_IN_MONTH = 10;
/** Обход очередей: в работе раз в десять минут, при сжатом времени — раз в минуту. */
const WORKER_PACE_SECONDS = 600;
const COMPRESSED_WORKER_PACE_SECONDS = 60;

const inProduction = (): boolean => process.env.NODE_ENV === 'production';
const inDevelopment = (): boolean => process.env.NODE_ENV === 'development';

/** Длина суток, секунд. */
export function eduDaySeconds(): number {
  if (inProduction()) return SECONDS_IN_DAY;
  const custom = Number(process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS);
  if (Number.isFinite(custom) && custom > 0) return Math.floor(custom);
  return inDevelopment() ? DEV_SECONDS_IN_DAY : SECONDS_IN_DAY;
}

/** Сутки укорочены — узел пишет об этом в журнал при запуске расширения. */
export function isDayShortened(): boolean {
  return eduDaySeconds() !== SECONDS_IN_DAY;
}

/** Длина месяца, секунд; 0 — календарные месяцы. */
export function eduMonthSeconds(): number {
  if (inProduction()) return 0;
  const raw = process.env.EDUBRIDGE_MONTH_SECONDS;
  if (raw !== undefined && raw.trim() !== '') {
    const custom = Number(raw);
    if (Number.isFinite(custom) && custom >= 0) return Math.floor(custom);
  }
  return inDevelopment() && isDayShortened() ? DAYS_IN_MONTH * eduDaySeconds() : 0;
}

/** Время сжато: начало занятий можно назвать с точностью до минуты, очереди ходят чаще. */
export function isTimeCompressed(): boolean {
  return eduMonthSeconds() > 0;
}

/** Как часто очереди образования обходят свои записи, секунд. */
export function workerPaceSeconds(): number {
  return isTimeCompressed() ? COMPRESSED_WORKER_PACE_SECONDS : WORKER_PACE_SECONDS;
}

/**
 * Очереди образования просыпаются каждую минуту и работают, когда пришёл их
 * черёд: в работе — на каждой десятой минуте, при сжатом времени — на каждой.
 */
export function isWorkerTurn(now: Date = new Date()): boolean {
  const paceMinutes = Math.max(1, Math.round(workerPaceSeconds() / 60));
  return now.getMinutes() % paceMinutes === 0;
}

/** Срок на отчёт преподавателя о занятиях оплаченного срока, суток. */
const REPORT_WINDOW_DAYS = 7;

/** До какого момента подписка с вышедшим оплаченным сроком остаётся в цепи: срок на отчёт преподавателя. */
export function reportWindowEndsAt(paidUntil: Date): Date {
  return new Date(paidUntil.getTime() + REPORT_WINDOW_DAYS * eduDaySeconds() * 1000);
}
