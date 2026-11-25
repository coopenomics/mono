import { GreetingTemplateKind, GreetingTemplateStatus } from './greetings.enums';
import { celebrationDate, formatDate, type CalendarDate } from './birthday';

/** Поля шаблона, по которым выбирается шаблон на дату. */
export interface TemplatePeriod {
  id: string;
  status: GreetingTemplateStatus;
  kind: GreetingTemplateKind;
  repeat_yearly?: boolean;
  /** Первый день периода, `ГГГГ-ММ-ДД`. */
  period_start: string;
  /** Последний день периода включительно, `ГГГГ-ММ-ДД`. */
  period_end: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Длина периода в днях: короче — точнее. */
function periodLength(template: TemplatePeriod): number {
  return (Date.parse(template.period_end) - Date.parse(template.period_start)) / DAY_MS;
}

/**
 * Шаблон на дату `ГГГГ-ММ-ДД`.
 *
 * Берутся только действующие шаблоны, чей период покрывает дату. Годовой
 * шаблон задаёт текст по умолчанию, а шаблон на июнь его уточняет: при
 * пересечении выигрывает более короткий период. При равной длине — тот, что
 * начался позже: председатель завёл его как поправку к прежнему.
 */
export function chooseTemplate<T extends TemplatePeriod>(templates: readonly T[], date: string): T | null {
  const fitting = templates.filter(
    (template) =>
      template.kind === GreetingTemplateKind.BIRTHDAY &&
      template.status === GreetingTemplateStatus.ACTIVE &&
      template.period_start <= date &&
      date <= template.period_end
  );
  fitting.sort((a, b) => periodLength(a) - periodLength(b) || b.period_start.localeCompare(a.period_start));
  return fitting[0] ?? null;
}

/** Период задан верно: обе даты существуют, начало не позже конца. */
export function isValidPeriod(start: string, end: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(start) || !pattern.test(end)) return false;
  if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) return false;
  // Date.parse принимает 2026-02-30 как 2 марта; сверяем обратным выводом.
  const sameDay = (value: string) => new Date(Date.parse(value)).toISOString().slice(0, 10) === value;
  return sameDay(start) && sameDay(end) && start <= end;
}

/**
 * Рассылки на день: действующие шаблоны-рассылки, чья дата — сегодня. Для
 * повторяющейся рассылки сравниваются месяц и день, начиная с года первой
 * даты; рассылку на 29 февраля в невисокосный год приложение отправляет 28-го.
 */
export function mailingsDue<T extends TemplatePeriod>(templates: readonly T[], today: CalendarDate): T[] {
  const date = formatDate(today);
  return templates.filter((template) => {
    if (template.kind !== GreetingTemplateKind.MAILING || template.status !== GreetingTemplateStatus.ACTIVE) return false;
    if (!template.repeat_yearly) return template.period_start === date;
    const [year, month, day] = template.period_start.split('-').map(Number);
    if (today.year < year) return false;
    return formatDate(celebrationDate({ month, day }, today.year)) === date;
  });
}

/**
 * Дата рассылки в месяце года: разовая — если её дата в этом месяце,
 * ежегодная — тот же день, начиная с года первой даты. `null` — в этом
 * месяце рассылки нет. Черновики тоже стоят в календаре: председатель видит,
 * что запланировал.
 */
export function mailingDateInMonth(template: TemplatePeriod, year: number, month: number): string | null {
  if (template.kind !== GreetingTemplateKind.MAILING) return null;
  const [startYear, startMonth, startDay] = template.period_start.split('-').map(Number);
  if (startMonth !== month) return null;
  if (!template.repeat_yearly) return startYear === year ? template.period_start : null;
  if (year < startYear) return null;
  return formatDate(celebrationDate({ month: startMonth, day: startDay }, year));
}
