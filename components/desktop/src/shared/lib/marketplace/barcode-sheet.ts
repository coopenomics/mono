import { printLabelSheet } from './print-sheet'

/**
 * Лист штрих-кодов на печать: нарезать и наклеить на имущество, а потом
 * привязать сканером к позициям склада.
 *
 * Этикетки печатаются впрок и «вслепую» — какой код на какой позиции окажется,
 * решает уже сканер. Поэтому коды случайные: никакого смысла выводить их из
 * заказа, партии или товара, всё равно наклеит человек.
 */

/** Случайный EAN-13: 12 цифр плюс контрольная. */
export function randomEAN13(): string {
  let base = ''
  for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10).toString()
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3)
  const check = (10 - (sum % 10)) % 10
  return `${base}${check}`
}

/**
 * Полосы штрих-кода строкой SVG — тот же псевдо-рендер, что и в `BarcodeDisplay`.
 *
 * Рисунок не является настоящим EAN-13 и сканером не читается: этикетка нужна,
 * чтобы человек отличил одну наклейку от другой, а привязка идёт по номеру под
 * полосами. Настоящий кодировщик здесь был бы обманом ожиданий — «сканируется»
 * должно означать «сканируется».
 */
export function barcodeSvg(code: string): string {
  const rects: { x: number; w: number }[] = []
  let x = 4
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i)
    const blackW = ((ch * 7) % 4) + 1
    const gapW = ((ch * 11) % 3) + 1
    rects.push({ x, w: blackW })
    x += blackW + gapW
    if (i % 2 === 0) {
      rects.push({ x, w: 1 })
      x += 2
    }
  }
  const last = rects[rects.length - 1]
  const total = (last ? last.x + last.w : 100) + 8
  const bars = rects
    .map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="64" fill="#111"/>`)
    .join('')
  return `<svg viewBox="0 0 ${total} 64" width="${total}" height="64" role="img" aria-label="Штрих-код ${code}">${bars}</svg>`
}

/** Напечатать лист из `count` этикеток со случайными номерами. */
export function printBarcodeSheet(count: number): void {
  const n = Math.trunc(count)
  if (n < 1) return
  const labels = Array.from({ length: n }, () => {
    const code = randomEAN13()
    return `${barcodeSvg(code)}<div class="code">${code}</div>`
  })
  printLabelSheet({ title: 'Этикетки', labels })
}
