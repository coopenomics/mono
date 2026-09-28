import moment from 'moment-timezone'

/**
 * Дата создания документа в `meta.created_at`.
 *
 * Мета хранит момент генерации в ISO 8601 (UTC, до миллисекунд):
 * `2026-09-24T11:05:31.123Z`. Человеку дата показывается в поясе
 * `meta.timezone` в виде `ДД.ММ.ГГГГ ЧЧ:ММ` — это делает рендер, мета вид для
 * человека не хранит.
 *
 * До 28.09.2026 фабрика писала в мету уже отформатированную дату
 * `ДД.ММ.ГГГГ ЧЧ:ММ`. Такие документы подписаны и лежат в цепи навсегда,
 * поэтому разбор понимает оба вида, а старая дата при показе остаётся как есть.
 */

/** Пояс документа, если мета его не называет. */
export const DEFAULT_DOCUMENT_TIMEZONE = 'Europe/Moscow'

/** Вид даты для человека и формат меты до 28.09.2026. */
export const DOCUMENT_DATE_DISPLAY_FORMAT = 'DD.MM.YYYY HH:mm'

const LEGACY_CREATED_AT = /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/

/** Дата меты записана в старом виде `ДД.ММ.ГГГГ ЧЧ:ММ`. */
export function isLegacyCreatedAt(value: string): boolean {
  return LEGACY_CREATED_AT.test(value)
}

/** Дата меты записана в ISO 8601. */
export function isIsoCreatedAt(value: string): boolean {
  return moment(value, moment.ISO_8601, true).isValid()
}

/** Момент генерации для новой меты. */
export function nowCreatedAt(): string {
  return new Date().toISOString()
}

/** Разбирает дату меты любого вида; непонятную дату не выдумывает. */
export function parseCreatedAt(value: string, timezone: string): moment.Moment {
  if (isLegacyCreatedAt(value))
    return moment.tz(value, DOCUMENT_DATE_DISPLAY_FORMAT, true, timezone)
  if (isIsoCreatedAt(value))
    return moment.tz(value, moment.ISO_8601, true, timezone)
  throw new Error(`Дата документа «${value}» не в формате ISO 8601`)
}

/**
 * Дата меты в виде для человека. ISO переводится в пояс документа; всё прочее
 * — старая дата меты и даты, записанные вручную, — уже в виде для человека и
 * возвращается как есть: так старый документ пересобирается байт в байт.
 */
export function formatCreatedAt(value: string, timezone: string): string {
  if (!isIsoCreatedAt(value))
    return value
  return parseCreatedAt(value, timezone).format(DOCUMENT_DATE_DISPLAY_FORMAT)
}

/** Дата и время по отдельности — для реквизитов решений и актов. */
export function splitCreatedAt(value: string, timezone: string): { date: string, time: string } {
  const [date = '', time = ''] = formatCreatedAt(value, timezone).split(' ')
  return { date, time }
}
