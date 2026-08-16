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
