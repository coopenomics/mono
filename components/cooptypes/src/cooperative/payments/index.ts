export interface IBankAccount {
  currency: string
  card_number?: string // < номер карты
  bank_name: string // < наименование банка
  account_number: string // < номер счёта
  details: {
    bik: string // < бик
    corr: string // < корр счёт
  }
}

export interface ISbpDetails {
  phone: string
}

export type MethodTypes = 'sbp' | 'bank_transfer'

export interface IPaymentData {
  username: string
  method_id: string
  method_type: MethodTypes
  is_default: boolean
  data: ISbpDetails | IBankAccount
  deleted?: boolean
  block_num?: number
}
