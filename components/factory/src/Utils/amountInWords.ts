/**
 * Сумма в рублях прописью: «30 000,00 RUB» → «тридцать тысяч рублей 00 копеек».
 *
 * Нужна договорам, где сумма указывается цифрами и прописью (договор о
 * беспроцентном займе). Принимает актив цепи («30000.0000 RUB») или число.
 */

const UNITS_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const UNITS_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

/** Форма слова по числу: 1 рубль, 2 рубля, 5 рублей. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

function tripleToWords(n: number, feminine: boolean): string {
  const words: string[] = []
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  if (h) words.push(HUNDREDS[h])
  if (t === 1) {
    words.push(TEENS[u])
  }
  else {
    if (t) words.push(TENS[t])
    if (u) words.push((feminine ? UNITS_F : UNITS_M)[u])
  }
  return words.join(' ')
}

const SCALES: Array<{ one: string, few: string, many: string, feminine: boolean }> = [
  { one: '', few: '', many: '', feminine: false },
  { one: 'тысяча', few: 'тысячи', many: 'тысяч', feminine: true },
  { one: 'миллион', few: 'миллиона', many: 'миллионов', feminine: false },
  { one: 'миллиард', few: 'миллиарда', many: 'миллиардов', feminine: false },
  { one: 'триллион', few: 'триллиона', many: 'триллионов', feminine: false },
]

/** Целое число прописью (мужской род): 1203 → «одна тысяча двести три». */
export function integerToWordsRu(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error(`integerToWordsRu: ожидалось неотрицательное число, получено ${value}`)
  if (value === 0) return 'ноль'
  const parts: string[] = []
  let rest = Math.floor(value)
  let scale = 0
  while (rest > 0 && scale < SCALES.length) {
    const triple = rest % 1000
    if (triple) {
      const s = SCALES[scale]
      const words = tripleToWords(triple, s.feminine)
      const name = scale ? pluralRu(triple, s.one, s.few, s.many) : ''
      parts.unshift(name ? `${words} ${name}` : words)
    }
    rest = Math.floor(rest / 1000)
    scale++
  }
  return parts.join(' ')
}

/**
 * Сумма прописью с копейками: «30000.5000 RUB» → «тридцать тысяч рублей 50 копеек».
 * Копейки — цифрами, как принято в договорах.
 */
export function amountInWordsRu(amount: string | number): string {
  const numeric = typeof amount === 'number' ? amount : Number.parseFloat(String(amount).replace(',', '.'))
  if (!Number.isFinite(numeric)) throw new Error(`amountInWordsRu: не удалось разобрать сумму «${amount}»`)
  // Считаем в целых копейках: при округлении дробной части отдельно сумма
  // 1,999 давала «один рубль 100 копеек».
  const total = Math.round(numeric * 100)
  const rubles = Math.floor(total / 100)
  const kopecks = total % 100
  const rubWord = pluralRu(rubles, 'рубль', 'рубля', 'рублей')
  const kopWord = pluralRu(kopecks, 'копейка', 'копейки', 'копеек')
  return `${integerToWordsRu(rubles)} ${rubWord} ${String(kopecks).padStart(2, '0')} ${kopWord}`
}

/** Сумма цифрами с разделителями разрядов: «30000.0000 RUB» → «30 000,00». */
export function amountDigitsRu(amount: string | number): string {
  const numeric = typeof amount === 'number' ? amount : Number.parseFloat(String(amount).replace(',', '.'))
  if (!Number.isFinite(numeric)) throw new Error(`amountDigitsRu: не удалось разобрать сумму «${amount}»`)
  const [int, frac = '00'] = numeric.toFixed(2).split('.')
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${frac}`
}
