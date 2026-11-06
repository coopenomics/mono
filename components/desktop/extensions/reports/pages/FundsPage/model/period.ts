import { ref } from 'vue'

/**
 * Период оборотов страницы «Фонды». Кнопка выбора живёт в шапке приложения
 * (`useHeaderActions`), а шапка рисуется вне дерева страницы — поэтому
 * значение лежит в модуле, общем для кнопки и страницы, а не передаётся
 * событием. Готовые периоды отвечают отчётности бухгалтера: месяц, квартал, год.
 */
export type FundsPeriodKey = 'month' | 'prevMonth' | 'quarter' | 'year' | 'prevYear' | 'all'

export const FUNDS_PERIOD_KEYS: FundsPeriodKey[] = ['month', 'prevMonth', 'quarter', 'year', 'prevYear', 'all']

/** По умолчанию — текущий год: отчёт о фондах по Положению годовой. */
export const fundsPeriod = ref<FundsPeriodKey>('year')

export interface FundsPeriodRange {
  date_from?: Date
  date_to?: Date
}

/** Границы периода в местном времени: с начала первого дня до конца последнего. */
export function fundsPeriodRange(key: FundsPeriodKey, now = new Date()): FundsPeriodRange {
  const y = now.getFullYear()
  const m = now.getMonth()
  const end = (year: number, month: number) => new Date(year, month + 1, 0, 23, 59, 59)
  switch (key) {
    case 'month':
      return { date_from: new Date(y, m, 1), date_to: end(y, m) }
    case 'prevMonth':
      return { date_from: new Date(y, m - 1, 1), date_to: end(y, m - 1) }
    case 'quarter': {
      const q = Math.floor(m / 3) * 3
      return { date_from: new Date(y, q, 1), date_to: end(y, q + 2) }
    }
    case 'year':
      return { date_from: new Date(y, 0, 1), date_to: end(y, 11) }
    case 'prevYear':
      return { date_from: new Date(y - 1, 0, 1), date_to: end(y - 1, 11) }
    default:
      return {}
  }
}
