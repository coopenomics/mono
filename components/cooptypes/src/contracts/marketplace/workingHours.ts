/**
 * Режим работы пункта выдачи: группировка дней недели (решение владельца
 * 19.11.2026). Подряд идущие дни с одинаковым режимом объединяются в одну
 * группу: «Пн–Пт 09:00–18:00», «Сб 10:00–15:00», «Вс выходной». Подписи дней
 * и слов «перерыв», «выходной» ставит потребитель на своём языке — стол и
 * уведомления узла показывают одну и ту же группировку.
 *
 * Время — местное время участка, как его ввёл председатель; пояс не
 * пересчитывается: пайщик получает заказ на участке по его часам.
 */

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type WeekDay = (typeof WEEK_DAYS)[number]

export interface IWorkingHoursBreak {
  start: string
  end: string
}

export interface IWorkingHoursDay {
  open?: string | null
  close?: string | null
  breaks?: IWorkingHoursBreak[] | null
}

export type IWorkingHours = Partial<Record<WeekDay, IWorkingHoursDay | null | undefined>>

export interface IWorkingHoursGroup {
  /** Первый день группы. */
  from: WeekDay
  /** Последний день группы; совпадает с `from` у одиночного дня. */
  to: WeekDay
  /** Часы работы; null — выходной. */
  hours: { open: string, close: string, breaks: IWorkingHoursBreak[] } | null
}

function dayHours(day: IWorkingHoursDay | null | undefined): IWorkingHoursGroup['hours'] {
  if (!day?.open || !day?.close)
    return null
  return { open: day.open, close: day.close, breaks: (day.breaks ?? []).filter(b => b?.start && b?.end) }
}

function sameHours(a: IWorkingHoursGroup['hours'], b: IWorkingHoursGroup['hours']): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Группы дней с одинаковым режимом по порядку недели; режим не задан ни для одного дня — пустой список. */
export function groupWorkingHours(hours: IWorkingHours | null | undefined): IWorkingHoursGroup[] {
  if (!hours)
    return []
  const perDay = WEEK_DAYS.map(day => dayHours(hours[day]))
  if (perDay.every(h => h === null))
    return []
  const groups: IWorkingHoursGroup[] = []
  for (let i = 0; i < WEEK_DAYS.length; i++) {
    const last = groups[groups.length - 1]
    if (last && sameHours(last.hours, perDay[i]))
      last.to = WEEK_DAYS[i]
    else
      groups.push({ from: WEEK_DAYS[i], to: WEEK_DAYS[i], hours: perDay[i] })
  }
  return groups
}

export interface IWorkingHoursLabels {
  /** Подпись дня недели: «Пн», «Вт», … */
  day: (day: WeekDay) => string
  /** Слово перед перерывами: «перерыв». */
  breakWord: string
  /** Слово для выходного: «выходной». */
  dayOff: string
}

/** Строки режима: «Пн–Пт 09:00–18:00, перерыв 13:00–14:00», «Вс выходной». */
export function formatWorkingHours(hours: IWorkingHours | null | undefined, labels: IWorkingHoursLabels): string[] {
  return groupWorkingHours(hours).map((g) => {
    const days = g.from === g.to ? labels.day(g.from) : `${labels.day(g.from)}–${labels.day(g.to)}`
    if (!g.hours)
      return `${days} ${labels.dayOff}`
    const breaks = g.hours.breaks.map(b => `${b.start}–${b.end}`).join(', ')
    return breaks
      ? `${days} ${g.hours.open}–${g.hours.close}, ${labels.breakWord} ${breaks}`
      : `${days} ${g.hours.open}–${g.hours.close}`
  })
}
