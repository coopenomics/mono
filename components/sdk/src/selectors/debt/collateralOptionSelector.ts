import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawCollateralOptionSelector = {
  key: true,
  human_name: true,
  source_wallet: true,
  pledge_wallet: true,
  available: true,
  basis_type: true,
  basis_signed: true,
  owner_contract: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['DebtCollateralOption']> = rawCollateralOptionSelector

export type collateralOptionModel = ModelTypes['DebtCollateralOption']

export const collateralOptionSelector = Selector('DebtCollateralOption')(rawCollateralOptionSelector)
