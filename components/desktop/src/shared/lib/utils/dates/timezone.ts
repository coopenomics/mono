import moment from './moment'
import { env } from 'src/shared/config/Environment'
import { t } from 'src/shared/i18n';

// Дефолтный часовой пояс - московский
const DEFAULT_TIMEZONE = 'Europe/Moscow'

/**
 * Получает часовой пояс из .env или возвращает московский по умолчанию
 */
export function getTimezone(): string {
  return env.TIMEZONE || DEFAULT_TIMEZONE
}

/**
 * Получает читаемое название часового пояса для отображения в UI
 */
export function getTimezoneLabel(): string {
  const tz = getTimezone()
  return tz === 'Europe/Moscow' ? t('utils.timezone.moscowAbbr') : tz
}

/**
 * Преобразует дату из UTC в локальный часовой пояс для отображения
 * @param utcDate - дата в UTC (из блокчейна)
 * @param format - формат отображения
 */
export function formatDateToLocalTimezone(utcDate: string | Date | unknown, format = 'DD.MM.YYYY HH:mm'): string {
  if (!utcDate || typeof utcDate !== 'string' && !(utcDate instanceof Date)) return ''

  const timezone = getTimezone()
  return moment.utc(utcDate).tz(timezone).format(format)
}

/**
 * Преобразует локальную дату (из формы) в UTC для отправки в блокчейн
 * @param localDate - дата в локальном часовом поясе
 * @param format - формат входной даты
 */
export function convertLocalDateToUTC(localDate: string, format = 'YYYY-MM-DDTHH:mm'): string {
  if (!localDate) return ''

  const timezone = getTimezone()
  return moment.tz(localDate, format, timezone).utc().format()
}

/**
 * Получает текущую дату в локальном часовом поясе для форм (формат datetime-local)
 * @param offsetMinutes - смещение от текущего времени в минутах
 */
export function getCurrentLocalDateForForm(offsetMinutes = 0): string {
  const timezone = getTimezone()
  return moment().tz(timezone).add(offsetMinutes, 'minutes').format('YYYY-MM-DDTHH:mm')
}

/**
 * Форматирует дату для отображения "от сейчас" с учетом часового пояса
 * @param utcDate - дата в UTC
 */
export function formatDateFromNow(utcDate: string | Date | unknown): string {
  if (!utcDate || typeof utcDate !== 'string' && !(utcDate instanceof Date)) return ''

  const timezone = getTimezone()
  return moment.utc(utcDate).tz(timezone).fromNow()
}

/**
 * Получает дату в локальном часовом поясе для форм (формат datetime-local) с заданным смещением в днях и временем
 * @param offsetDays - смещение от текущей даты в днях
 * @param hour - час (0-23)
 * @param minute - минута (0-59)
 */
export function getFutureDateForForm(offsetDays = 0, hour = 0, minute = 0): string {
  const timezone = getTimezone()
  return moment().tz(timezone).add(offsetDays, 'days').set({ hour, minute, second: 0, millisecond: 0 }).format('YYYY-MM-DDTHH:mm')
}
