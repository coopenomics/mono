import { t } from 'src/shared/i18n'
import type { IWorkingHours, IWorkingHoursDay } from '../model/types'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = (typeof DAYS)[number]

/** Подпись дня недели: «Пн», «Вт», … */
function dayLabel(day: Day): string {
  return t(`marketplaceDetailKU.marketplaceDetailKUDialog.day.${day}`)
}

/** Режим одного дня строкой: «09:00–18:00, перерыв 13:00–14:00»; без режима — null (выходной). */
function daySchedule(day: IWorkingHoursDay | undefined): string | null {
  if (!day?.open || !day?.close) return null
  const breaks = (day.breaks ?? []).map((b) => `${b.start}–${b.end}`).join(', ')
  return breaks
    ? `${day.open}–${day.close}, ${t('marketplace.workingHours.break')} ${breaks}`
    : `${day.open}–${day.close}`
}

/**
 * Режим работы пункта выдачи для показа пайщику. Подряд идущие дни с
 * одинаковым режимом объединяются: «Пн–Пт 09:00–18:00», «Сб 10:00–15:00»,
 * «Вс выходной». Режим не задан ни для одного дня — пустой список.
 */
export function formatWorkingHours(hours: IWorkingHours | null | undefined): string[] {
  if (!hours) return []
  const schedules = DAYS.map((day) => daySchedule(hours[day]))
  if (schedules.every((s) => s === null)) return []

  const lines: string[] = []
  let start = 0
  for (let i = 1; i <= DAYS.length; i++) {
    if (i < DAYS.length && schedules[i] === schedules[start]) continue
    const days = i - 1 === start ? dayLabel(DAYS[start]) : `${dayLabel(DAYS[start])}–${dayLabel(DAYS[i - 1])}`
    lines.push(`${days} ${schedules[start] ?? t('marketplace.workingHours.dayOff')}`)
    start = i
  }
  return lines
}
