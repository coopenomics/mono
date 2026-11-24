/**
 * Дата рождения и календарь именинников.
 *
 * Чистые функции без зависимостей: их зовут и рассылка, и календарь, и
 * предпросмотр письма, поэтому правило «29 февраля в невисокосный год
 * поздравляем 28-го» и счёт возраста живут в одном месте.
 */

/** Дата без времени: год, месяц 1–12, день 1–31. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** День рождения без года. */
export interface MonthDay {
  month: number;
  day: number;
}

const ISO = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
const RUSSIAN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/;

/**
 * Разбор даты рождения из данных пайщика.
 *
 * Форма записи сложилась разная: регистрация пишет `ГГГГ-ММ-ДД`, загрузка
 * списком и старые записи — `ДД.ММ.ГГГГ`. Возвращает `null` для пустой или
 * несуществующей даты: такого пайщика календарь не содержит.
 */
export function parseBirthdate(value: string | null | undefined): CalendarDate | null {
  if (!value) return null;
  const text = value.trim();
  const iso = ISO.exec(text);
  const ru = iso ? null : RUSSIAN.exec(text);
  const parts = iso ? [iso[1], iso[2], iso[3]] : ru ? [ru[3], ru[2], ru[1]] : null;
  if (!parts) return null;
  const [year, month, day] = parts.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Сегодняшняя дата в часовой зоне кооператива.
 *
 * Сервер живёт в UTC, а день рождения наступает по местному времени: в
 * Новосибирске он начинается на семь часов раньше, чем по UTC.
 */
export function localDate(now: Date, timezone: string): CalendarDate & { hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

/**
 * Какие дни рождения поздравляются в эту дату.
 *
 * Обычно один день. 28 февраля невисокосного года — ещё и 29 февраля:
 * родившийся 29-го иначе остался бы без поздравления три года из четырёх.
 */
export function birthdaysCelebratedOn(date: CalendarDate): MonthDay[] {
  const days: MonthDay[] = [{ month: date.month, day: date.day }];
  if (date.month === 2 && date.day === 28 && !isLeapYear(date.year)) days.push({ month: 2, day: 29 });
  return days;
}

/** Дата поздравления в заданном году: 29 февраля невисокосного года — 28-е. */
export function celebrationDate(birth: MonthDay, year: number): CalendarDate {
  const day = birth.month === 2 && birth.day === 29 && !isLeapYear(year) ? 28 : birth.day;
  return { year, month: birth.month, day };
}

/** Сколько лет исполняется в заданном году. */
export function ageInYear(birthYear: number, year: number): number {
  return year - birthYear;
}

/** Дата строкой `ГГГГ-ММ-ДД` — так её хранит колонка `date`. */
export function formatDate(date: CalendarDate): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Сравнение дат без времени: отрицательное — первая раньше. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}
