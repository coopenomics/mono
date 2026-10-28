import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData, ExternalProjectData, IVars, InternalEntrepreneurData, InternalIndividualData, InternalOrganizationData, InternalProjectData, ExternalUdata, InternalUdata } from '../Models'
import type { PaymentData } from '../Models/PaymentMethod'
import type { IGeneratedDocument } from './Documents'
import type { IPaymentData } from './BankAccounts'

export interface IFilterDeltas {
  present: boolean
  code: string
  scope: string
  table: string
  primary_key: string
  value?: any
  block_num: number
  block_id: string
}

export interface IFilterActions {
  transaction_id: string
  account: string // < контракт действия, например, eosio.token
  name: string // < название действия, например, transfer
  authorization: Array<{
    actor: string
    permission: string
  }>
  data: any
}

export interface IBCState {
  key: string
  block_num: number
}

/** Отбор сохранённого документа: по хэшу, при необходимости по ключу меты или блоку. */
export interface IDocumentFilter {
  hash: string
  meta_key?: string
  'meta.block_num'?: number
}

export type internalFilterTypes = InternalIndividualData | InternalEntrepreneurData | InternalOrganizationData | IPaymentData | IVars | InternalProjectData | InternalUdata
export type externalDataTypes = ExternalIndividualData | ExternalEntrepreneurData | ExternalOrganizationData | PaymentData | IVars | ExternalProjectData | ExternalUdata
export type externalDataTypesArrays = ExternalIndividualData[] | ExternalEntrepreneurData[] | ExternalOrganizationData[] | PaymentData[] | IVars[] | ExternalProjectData[] | ExternalUdata[]
