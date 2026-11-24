import { GreetingTemplateStatus } from './greetings.enums';

/** Поля шаблона, по которым выбирается шаблон на дату. */
export interface TemplatePeriod {
  id: string;
  status: GreetingTemplateStatus;
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
      template.status === GreetingTemplateStatus.ACTIVE && template.period_start <= date && date <= template.period_end
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
