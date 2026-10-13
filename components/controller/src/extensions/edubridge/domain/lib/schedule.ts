import { DomainError, platformSettings } from '@coopenomics/extension-kit';
import { t } from '../../i18n';

/**
 * Окно расписания: день недели, время начала, длительность и преподаватель.
 * Из окон и даты начала группы строится календарь занятий. Время окна —
 * местное время кооператива (часовой пояс из настроек контура).
 */
export interface EduScheduleSlot {
  /** День недели: 1 — понедельник … 7 — воскресенье; 8 — резерв: минуты для внеочередных занятий. */
  weekday: number;
  /** Время начала «ЧЧ:ММ» по часовому поясу кооператива. */
  time: string;
  /** Длительность занятия, минут. */
  minutes: number;
  /** Допуск преподавателя, который ведёт занятия этого окна; `null` — преподаватель не назначен. */
  assignment_id: string | null;
  /** Плановая стоимость занятия окна для одного участника («1000.0000 RUB»): заложена во взнос, потолок взноса преподавателя. */
  cost: string;
}

const ASSET_RE = /^\d+\.\d{4} [A-Z]{1,7}$/;
const ASSET_SCALE = 10_000;

function assetMinor(value: string): number {
  return Math.round(Number(value.trim().split(' ')[0]) * ASSET_SCALE);
}

function assetOf(minor: number, symbol: string): string {
  return `${(minor / ASSET_SCALE).toFixed(4)} ${symbol}`;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** «Восьмой день» окна — резерв: его минуты входят в программу, а в календарь их ставит администратор внеочередным занятием. */
export const RESERVE_WEEKDAY = 8;

export const isReserveSlot = (s: Pick<EduScheduleSlot, 'weekday'>): boolean => Number(s.weekday) === RESERVE_WEEKDAY;

/** Окна в рабочем виде: проверены и упорядочены по дню недели и времени. */
export function normalizeSlots(raw: readonly Partial<EduScheduleSlot>[] | null | undefined): EduScheduleSlot[] {
  const slots = (raw ?? []).map((s) => {
    const weekday = Number(s.weekday);
    const time = String(s.time ?? '').trim();
    const minutes = Number(s.minutes);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > RESERVE_WEEKDAY) throw DomainError.badRequest('EDUBRIDGE_SCHEDULE_WEEKDAY_INVALID');
    if (weekday !== RESERVE_WEEKDAY && !TIME_RE.test(time)) throw DomainError.badRequest('EDUBRIDGE_SCHEDULE_TIME_INVALID');
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 24 * 60) throw DomainError.badRequest('EDUBRIDGE_SCHEDULE_MINUTES_INVALID');
    const cost = String(s.cost ?? '').trim();
    if (!ASSET_RE.test(cost)) throw DomainError.badRequest('EDUBRIDGE_SCHEDULE_COST_INVALID');
    return { weekday, time: weekday === RESERVE_WEEKDAY ? '' : time, minutes, assignment_id: s.assignment_id ? String(s.assignment_id) : null, cost };
  });
  return slots.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
}

/**
 * Расписание строкой для каталога: «Вт, Чт 17:00–18:30». Окна с одним
 * временем и длительностью складываются в одну группу дней.
 */
export function formatSlots(slots: readonly EduScheduleSlot[]): string {
  const groups = new Map<string, number[]>();
  const reserve = weeklyMinutes(slots.filter(isReserveSlot));
  for (const s of slots) {
    if (isReserveSlot(s)) continue;
    const key = `${s.time}|${s.minutes}`;
    groups.set(key, [...(groups.get(key) ?? []), s.weekday]);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const [time, minutes] = key.split('|');
      const names = [...new Set(days)].sort((a, b) => a - b).map((d) => t(`edubridge.schedule.weekday.${d}` as never)).join(', ');
      return `${names} ${time}–${addMinutes(time, Number(minutes))}`;
    })
    .concat(reserve > 0 ? [t('edubridge.schedule.reserveLine', { minutes: reserve })] : [])
    .join('; ');
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Часовой пояс кооператива: по нему читаются окна расписания. */
export function eduTimezone(): string {
  return platformSettings().timezone || 'UTC';
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 1 — понедельник … 7 — воскресенье. */
  weekday: number;
}

const WEEKDAY_OF: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Разбор момента в частях местного времени пояса. */
export function zonedParts(date: Date, tz: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_OF[parts.weekday] ?? 1,
  };
}

/** Момент по местным году, месяцу, дню и времени пояса; переход на летнее время учитывается двумя проходами. */
export function zonedMoment(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i += 1) {
    const p = zonedParts(new Date(guess), tz);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    if (seen === wanted) break;
    guess += wanted - seen;
  }
  return new Date(guess);
}

/** Один момент занятия из календаря: когда, по какому окну и под каким индексом окно стоит в условиях группы. */
export interface SlotOccurrence {
  at: Date;
  slot: EduScheduleSlot;
  index: number;
}

/** Индекс резервного окна в окнах группы; `null` — резерва нет. Индексы — по порядку окон, как они ушли в цепь. */
export function reserveIndex(slots: readonly Pick<EduScheduleSlot, 'weekday'>[]): number | null {
  const i = slots.findIndex(isReserveSlot);
  return i >= 0 ? i : null;
}

/**
 * Моменты занятий по окнам от дня начала: по каждому дню недели, который есть
 * среди окон, — его окна по времени. Первый день — день начала занятий, даже
 * когда время окна в этот день уже прошло: начало занятий называет день.
 * Генератор отдаёт не больше `limit` моментов; окон нет — пусто.
 */
export function slotOccurrences(slots: readonly EduScheduleSlot[], startsAt: Date, limit: number, tz: string = eduTimezone()): SlotOccurrence[] {
  if (!slots.length || limit <= 0) return [];
  const out: SlotOccurrence[] = [];
  const weekly = slots.map((slot, index) => ({ slot, index })).filter((x) => !isReserveSlot(x.slot));
  if (!weekly.length) return [];
  const start = zonedParts(startsAt, tz);
  // Перебор по дням от дня начала; верхняя граница страхует от бесконечного цикла при нулевом лимите на день.
  const day = Date.UTC(start.year, start.month - 1, start.day);
  for (let offset = 0; offset < 366 * 3 && out.length < limit; offset += 1) {
    const d = new Date(day + offset * 24 * 60 * 60 * 1000);
    const weekday = ((d.getUTCDay() + 6) % 7) + 1;
    for (const { slot, index } of weekly) {
      if (slot.weekday !== weekday || out.length >= limit) continue;
      const [h, m] = slot.time.split(':').map(Number);
      out.push({ at: zonedMoment(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, m, tz), slot, index });
    }
  }
  return out;
}

/** Недель в месяце для перевода недельного расписания в месячное: 52 недели на 12 месяцев. */
export const WEEKS_PER_MONTH = 52 / 12;

/** Минут занятий в неделю по окнам расписания. */
export function weeklyMinutes(slots: readonly Pick<EduScheduleSlot, 'minutes'>[]): number {
  return slots.reduce((sum, s) => sum + Number(s.minutes || 0), 0);
}

/** Числа программы из окон расписания и длительности в месяцах; учёт — в минутах, занятия — для показа. */
export interface ProgramNumbers {
  /** Минут занятий в месяц: минуты недели на 52/12. */
  minutes_per_month: number;
  /** Минут занятий в программе; 0 — программа без конца. */
  minutes_total: number;
  /** Занятий в месяц для показа. */
  lessons_per_month: number;
  /** Занятий в программе для показа; 0 — программа без конца. */
  lessons_total: number;
  /** Длительность занятия по первому окну — длительность по умолчанию для занятия сверх расписания. */
  lesson_minutes: number;
  /** Минут резерва в месяц — для внеочередных занятий. */
  reserve_per_month: number;
  /** Оплата занятий месяца одним участником: стоимости окон недели на 52/12, как считает контракт. */
  teach_month: string;
  /** Плановая ставка часа как среднее по окнам — для показа и ставки допуска по умолчанию. */
  planned_hourly_rate: string;
}

export function programOf(slots: readonly Pick<EduScheduleSlot, 'minutes' | 'weekday' | 'cost'>[], programMonths: number): ProgramNumbers {
  const months = Math.max(0, Math.floor(Number(programMonths || 0)));
  const weekly = slots.filter((s) => !isReserveSlot(s as EduScheduleSlot));
  const minutesPerMonth = Math.round(weeklyMinutes(slots) * WEEKS_PER_MONTH);
  const lessonsPerMonth = Math.round(weekly.length * WEEKS_PER_MONTH);
  // Как в контракте (`edu_terms::teach_month`): сумма стоимостей окон недели на 52/12, нацело.
  const symbol = String(slots[0]?.cost ?? '').trim().split(' ')[1] ?? '';
  const weekCost = slots.reduce((sum, s) => sum + (ASSET_RE.test(String(s.cost ?? '')) ? assetMinor(String(s.cost)) : 0), 0);
  const teachMonth = Math.floor((weekCost * 52) / 12);
  const hourly = minutesPerMonth > 0 ? Math.round((teachMonth * 60) / minutesPerMonth) : 0;
  return {
    teach_month: assetOf(teachMonth, symbol),
    planned_hourly_rate: assetOf(hourly, symbol),
    minutes_per_month: minutesPerMonth,
    minutes_total: minutesPerMonth * months,
    lessons_per_month: lessonsPerMonth,
    lessons_total: lessonsPerMonth * months,
    lesson_minutes: Number((weekly[0] ?? slots[0])?.minutes ?? 60),
    reserve_per_month: Math.round(weeklyMinutes(slots.filter((s) => isReserveSlot(s as EduScheduleSlot))) * WEEKS_PER_MONTH),
  };
}
