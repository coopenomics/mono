/**
 * Деньги и доли для текста документа: строковая арифметика без погрешности
 * плавающей точки (шаг 2 фабрики v2, FR19). Принцип: никогда не показать в
 * документе сумму больше реальной — лишние знаки отсекаются, не округляются.
 */

/**
 * Усечение числовой строки до displayPrecision знаков на уровне строки:
 * 0.29 * 100 в IEEE 754 даёт 28.999…, строка такой ошибки не знает.
 */
export function truncateDecimal(numericStr: string, displayPrecision: number): string {
  const negative = numericStr.startsWith('-')
  const abs = negative ? numericStr.slice(1) : numericStr
  const [intPartRaw, decPartRaw = ''] = abs.split('.')
  const intPart = intPartRaw || '0'
  const decPart = decPartRaw.padEnd(displayPrecision, '0').slice(0, displayPrecision)
  const result = displayPrecision > 0 ? `${intPart}.${decPart}` : intPart
  return negative ? `-${result}` : result
}

export function formatShare(value: string | number, precision: number = 2): string {
  const str = typeof value === 'string' ? value : value.toString()
  const parsed = Number.parseFloat(str)
  if (Number.isNaN(parsed))
    return typeof value === 'string' ? value : value.toString()
  return truncateDecimal(parsed.toFixed(precision + 4), precision)
}

/**
 * Сумма для текста документа — единственный способ писать деньги: два знака
 * после точки, остальное отсекается. Принимает сумму с символом валюты
 * («300.0000 RUB» → «300.00 RUB») и голое число («300.0000» → «300.00») —
 * второе нужно шаблонам, где валюта стоит в подписи колонки. Строку иного
 * вида (уже оформленную человеком) отдаёт как есть.
 */
export function formatAsset(asset: string | number, precision: number = 2): string {
  if (asset === undefined || asset === null || asset === '')
    return ''
  const text = String(asset).trim()
  const match = text.match(/^(-?\d+(?:\.\d+)?)(?:\s+([A-Z]+))?$/)
  if (!match)
    return text
  const [, amount, symbol] = match
  const value = truncateDecimal(amount, precision)
  return symbol ? `${value} ${symbol}` : value
}
