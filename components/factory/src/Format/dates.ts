/**
 * Даты для текста документа (шаг 2 фабрики v2). Момент создания приходит
 * метой в ISO, часовой пояс — метой же; текущее время читается только когда
 * даты в мете нет, и это поведение сохранено как было.
 */
import moment from 'moment-timezone'
import { parseCreatedAt } from '../Utils/documentCreatedAt'

/** День, месяц и две цифры года для реквизитов соглашений. */
export function dateForAgreements(created_at: string, timezone: string): { day: string, month: string, year: string } {
  const dateWithTimezone = created_at
    ? parseCreatedAt(created_at, timezone)
    : moment.tz(timezone)

  return {
    day: dateWithTimezone.format('DD'),
    month: dateWithTimezone.format('MM'),
    year: dateWithTimezone.format('YY'),
  }
}
