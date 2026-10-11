import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

/** Визит на участок по отсканированному коду (598-62). */
export const rawScanMatterSelector = {
  kind: true,
  ids: true,
}

const _validateMatter: MakeAllFieldsRequired<ValueTypes['MarketplaceScanMatter']> =
  rawScanMatterSelector

export const rawScanVisitSelector = {
  target: true,
  account: true,
  display_name: true,
  matters: rawScanMatterSelector,
  shipment_id: true,
  container_code: true,
}

const _validateVisit: MakeAllFieldsRequired<ValueTypes['MarketplaceScanVisit']> =
  rawScanVisitSelector

export const marketplaceScanVisitSelector = Selector('MarketplaceScanVisit')(rawScanVisitSelector)

/** Код передачи пайщика, выданный сервером. */
export const rawHandoffCodeSelector = {
  kind: true,
  code: true,
  expires_at: true,
}

const _validateHandoffCode: MakeAllFieldsRequired<ValueTypes['MarketplaceHandoffCode']> =
  rawHandoffCodeSelector

export const marketplaceHandoffCodeSelector = Selector('MarketplaceHandoffCode')(rawHandoffCodeSelector)
