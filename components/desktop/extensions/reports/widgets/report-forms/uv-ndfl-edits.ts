/**
 * Форма правок уведомления об исчисленных суммах НДФЛ — зеркало
 * `UvNdflEditsShape` бэкенда. Шапка, реквизиты и подписант общие с прочими
 * формами (их правит `ZeroReportEditor`), своя здесь только сумма.
 */

export interface UvNdflEdits {
  header: {
    idFile: string
    versProgram: string
    docDate: string
    reportYear: number
    /** Сквозной номер расчётного периода 1..24 — по два на каждый месяц. */
    period: number | null
    correctionNumber: number
  }
  organization: {
    orgName: string
    inn: string
    kpp: string
    oktmo: string | null
    okved: string | null
    okfs: string | null
    okopf: string | null
    okpo: string | null
    ogrn: string | null
    address: string | null
    phone: string | null
  }
  signer: {
    type: 'chairman' | 'representative'
    lastName: string
    firstName: string
    middleName: string | null
    repDoc: string | null
    snils: string | null
    sfrRegNumber: string | null
    pfrRegNumber: string | null
    chairmanPosition: string | null
  }
  payment: {
    /** Сумма налога к перечислению за период, целые рубли. */
    amount: number
  }
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/**
 * Человеческая расшифровка расчётного периода: сквозной номер 1..24 сам по
 * себе бухгалтеру ничего не говорит. Показывается и в шапке отчёта, и рядом
 * с суммой.
 */
export function uvNdflPeriodTitle(period: number | null | undefined): string {
  if (!period || period < 1 || period > 24) return '—'
  const month = MONTHS[Math.floor((period - 1) / 2)] ?? ''
  const half = period % 2 === 0 ? 'с 23 по последнее число' : 'с 1 по 22 число'
  return `${month}, ${half}`
}
