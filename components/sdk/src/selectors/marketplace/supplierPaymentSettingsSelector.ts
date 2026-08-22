import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawSupplierPaymentSettingsSelector = {
  payout_method_id: true,
  has_payout_method: true,
  payout_destination: true,
}

const _validateSupplierPaymentSettings: MakeAllFieldsRequired<
  ValueTypes['MarketplaceSupplierPaymentSettings']
> = rawSupplierPaymentSettingsSelector

export const marketplaceSupplierPaymentSettingsSelector = Selector(
  'MarketplaceSupplierPaymentSettings',
)(rawSupplierPaymentSettingsSelector)
