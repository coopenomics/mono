import { uiLocale } from 'src/shared/i18n';
export function formatCalendarDateTime(v: Date | string | null | undefined): string {
  if (v == null) return '—'
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(uiLocale())
}

export function toDatetimeLocalValue(d: Date | string | null | undefined): string {
  if (d == null) return ''
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

export function parseDatetimeLocalValue(s: string): Date | null {
  if (!s.trim()) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}
