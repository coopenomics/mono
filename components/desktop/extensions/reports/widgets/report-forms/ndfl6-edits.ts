/**
 * Форма правок 6-НДФЛ на клиенте — зеркало `Ndfl6EditsShape` бэкенда.
 *
 * Шапка, реквизиты и подписант повторяют структуру остальных отчётов
 * (`ZeroReportEditor` работает с ними как есть); разделы с суммами и справки
 * о доходах есть только у этой формы.
 */

export interface Ndfl6MonthlyIncome {
  /** Порядковый номер месяца, 1–12. */
  month: number
  /** Код вида дохода: 2710 — материальная помощь лицу, не являющемуся работником. */
  incomeCode: string
  amount: number
}

export interface Ndfl6Certificate {
  username: string
  number: number
  /** Номер корректировки справки, ровно две цифры. */
  correctionNumber: string
  lastName: string
  firstName: string
  middleName: string | null
  /** Дата рождения в формате ДД.ММ.ГГГГ. */
  birthDate: string
  /** Код статуса налогоплательщика: 1 — резидент РФ. */
  taxpayerStatus: string
  /** Гражданство, код страны по ОКСМ: 643 — Россия. */
  citizenshipCode: string
  /** Код вида документа: 21 — паспорт РФ. */
  documentTypeCode: string
  /** Серия и номер документа одной строкой. */
  documentSerialNumber: string
  incomeTotal: number
  taxBase: number
  taxCalculated: number
  taxWithheld: number
  monthlyIncome: Ndfl6MonthlyIncome[]
}

export interface Ndfl6Tax {
  peopleCount: number
  /** Доход, налоговая база и вычеты — нарастающим итогом с начала года. */
  incomeTotal: number
  deductionsTotal: number
  taxBase: number
  taxCalculated: number
  withheldTotal: number
  /** Шесть сроков перечисления последнего квартала отчётного периода. */
  byTerm: number[]
}

export interface Ndfl6Edits {
  header: {
    idFile: string
    versProgram: string
    docDate: string
    reportYear: number
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
  tax: Ndfl6Tax
  /** Справки о доходах — заполняются только в годовом отчёте. */
  certificates: Ndfl6Certificate[]
}
