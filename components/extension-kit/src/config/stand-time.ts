/**
 * Шкала времени стенда — общая для всех приложений (решение владельца 01.11.2026).
 *
 * В работе сутки и месяцы настоящие. На стенде разработки время сжимают, чтобы
 * процессы со сроками проходились за минуты: гарантийный срок заказа, списание
 * обеспечительной части первого числа месяца, сроки курсов «Образования».
 * Каждое приложение берёт длины из этой шкалы, а не держит свои переменные, — иначе
 * на одном стенде сутки разной длины в разных приложениях, и процессы,
 * связанные между собой, расходятся.
 *
 * Переменные окружения контроллера:
 *  - `STAND_DAY_SECONDS` — длина суток, секунд (86400 — настоящие);
 *  - `STAND_MONTH_SECONDS` — длина месяца, секунд; 0 — настоящий месяц. Не
 *    задана — при укороченных сутках месяц равен десяти суткам;
 *  - `STAND_WORKER_PACE_SECONDS` — шаг фоновых обходов при сжатом времени,
 *    секунд; не задан — минута.
 *
 * `NODE_ENV=production` (боевая и тестовая сеть) — сжатия нет никогда, переменные
 * не действуют: ошибка в окружении прода не сокращает ничьих сроков.
 *
 * Прежние переменные «Образования» (`EDUBRIDGE_GUARANTEE_DAY_SECONDS` и др.)
 * читает само «Образование» как запасные — ради стендов, где они уже стоят.
 */

const SECONDS_IN_DAY = 24 * 60 * 60;
/** Суток в месяце сжатого времени, если длина месяца не задана. */
const DAYS_IN_COMPRESSED_MONTH = 10;
/** Шаг фоновых обходов при сжатом времени, если не задан. */
const COMPRESSED_WORKER_PACE_SECONDS = 60;

function inProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Целое неотрицательное число из окружения; пусто или мусор — `null`. */
function envSeconds(name: string, allowZero: boolean): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (allowZero ? value < 0 : value <= 0) return null;
  return Math.floor(value);
}

/** Длина суток на стенде, секунд. В работе — всегда настоящие сутки. */
export function standDaySeconds(): number {
  if (inProduction()) return SECONDS_IN_DAY;
  return envSeconds('STAND_DAY_SECONDS', false) ?? SECONDS_IN_DAY;
}

/** Задана ли шкала стенда явно (хоть одна из переменных). */
export function isStandTimeConfigured(): boolean {
  if (inProduction()) return false;
  return (
    envSeconds('STAND_DAY_SECONDS', false) !== null ||
    envSeconds('STAND_MONTH_SECONDS', true) !== null ||
    envSeconds('STAND_WORKER_PACE_SECONDS', false) !== null
  );
}

/** Длина месяца на стенде, секунд; 0 — настоящий месяц. */
export function standMonthSeconds(): number {
  if (inProduction()) return 0;
  const custom = envSeconds('STAND_MONTH_SECONDS', true);
  if (custom !== null) return custom;
  return standDaySeconds() !== SECONDS_IN_DAY ? DAYS_IN_COMPRESSED_MONTH * standDaySeconds() : 0;
}

/** Время сжато: сутки короче настоящих либо месяц задан длиной. */
export function isStandTimeCompressed(): boolean {
  return standDaySeconds() !== SECONDS_IN_DAY || standMonthSeconds() > 0;
}

/**
 * Шаг фонового обхода, секунд: в работе — свой шаг приложения, при сжатом
 * времени — шаг стенда (по умолчанию минута).
 */
export function standWorkerPaceSeconds(productionPaceSeconds: number): number {
  if (!isStandTimeCompressed()) return productionPaceSeconds;
  return envSeconds('STAND_WORKER_PACE_SECONDS', false) ?? COMPRESSED_WORKER_PACE_SECONDS;
}

/**
 * Черёд фонового обхода, который просыпается каждую минуту: в работе — на
 * каждой минуте, кратной своему шагу (шаг часа — нулевая минута часа), при
 * сжатом времени — по шагу стенда.
 */
export function isStandWorkerTurn(productionPaceSeconds: number, now: Date = new Date()): boolean {
  const paceMinutes = Math.max(1, Math.round(standWorkerPaceSeconds(productionPaceSeconds) / 60));
  const minutes = Math.floor(now.getTime() / 60_000);
  return minutes % paceMinutes === 0;
}

/**
 * Номер расчётного периода «месяц», в который попадает момент. В работе —
 * календарный месяц в часовом поясе кооператива (год × 12 + месяц). При
 * заданной длине месяца стенда — номер отрезка этой длины от начала эпохи:
 * «первое число» наступает каждые `STAND_MONTH_SECONDS` секунд.
 */
export function standPeriodKey(date: Date, timeZone: string): number {
  const monthSeconds = standMonthSeconds();
  if (monthSeconds > 0) return Math.floor(date.getTime() / 1000 / monthSeconds);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 0);
  return year * 12 + month;
}

/**
 * Начало расчётного месяца, следующего за моментом: «первое число», с
 * которого строка созревает к списанию. В работе — 00:00 первого числа
 * следующего календарного месяца в часовом поясе кооператива, при заданной
 * длине месяца стенда — начало следующего отрезка этой длины.
 */
export function standNextPeriodStart(date: Date, timeZone: string): Date {
  const monthSeconds = standMonthSeconds();
  if (monthSeconds > 0) {
    return new Date((Math.floor(date.getTime() / 1000 / monthSeconds) + 1) * monthSeconds * 1000);
  }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  // Полночь первого числа в часовом поясе кооператива: берём ту же дату в UTC
  // и сдвигаем на смещение пояса в этот момент.
  const utcMidnight = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1);
  return new Date(utcMidnight - timeZoneOffsetMs(new Date(utcMidnight), timeZone));
}

/** Смещение часового пояса от UTC в момент, миллисекунд (Москва — +3 ч). */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Строка для журнала при запуске: какая шкала действует. */
export function describeStandTime(): string {
  if (!isStandTimeCompressed()) return 'время настоящее'; // i18n-ignore: строка журнала узла, не текст интерфейса
  const month = standMonthSeconds();
  return `время стенда сжато: сутки ${standDaySeconds()} с, месяц ${month > 0 ? `${month} с` : 'настоящий'}, шаг обходов ${standWorkerPaceSeconds(0)} с`; // i18n-ignore: строка журнала узла, не текст интерфейса
}
