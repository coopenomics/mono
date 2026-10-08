/**
 * Сумма документа цифрами. Валюту называет символ самого актива цепи: у каждой
 * сети кооперативов он свой, поэтому в текст шаблона валюта не вписывается.
 */

/** Символ валюты из актива цепи: «30000.0000 RUB» → «RUB»; у числа символа нет. */
export function assetSymbol(amount: string | number): string {
  if (typeof amount === 'number') return ''
  const m = /\s([A-Z]{1,7})\s*$/.exec(String(amount))
  return m ? m[1] : ''
}

/** Сумма цифрами с разделителями разрядов, без валюты: «30000.0000 RUB» → «30 000,00». */
export function amountDigitsRu(amount: string | number): string {
  const numeric = typeof amount === 'number' ? amount : Number.parseFloat(String(amount).replace(',', '.'))
  if (!Number.isFinite(numeric)) throw new Error(`amountDigitsRu: не удалось разобрать сумму «${amount}»`)
  const [int, frac = '00'] = numeric.toFixed(2).split('.')
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${frac}`
}

/** Сумма цифрами с символом валюты из актива: «30000.0000 RUB» → «30 000,00 RUB». */
export function amountWithSymbolRu(amount: string | number): string {
  const symbol = assetSymbol(amount)
  return symbol ? `${amountDigitsRu(amount)} ${symbol}` : amountDigitsRu(amount)
}
