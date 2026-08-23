import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawSupplierSelector = {
  id: true,
  coopname: true,
  member_account: true,
  model: true,
  status: true,
  contract_number: true,
  contract_date: true,
  contract_document_url: true,
  requested_by: true,
  requested_at: true,
  reviewed_by: true,
  reviewed_at: true,
}

const _validateSupplier: MakeAllFieldsRequired<ValueTypes['MarketplaceSupplier']> =
  rawSupplierSelector

export const marketplaceSupplierSelector = Selector('MarketplaceSupplier')(rawSupplierSelector)
