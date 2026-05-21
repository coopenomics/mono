import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

const rawModerationLogEntrySelector = {
  id: true,
  offer_id: true,
  action: true,
  by_account: true,
  reason: true,
  created_at: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['MarketplaceModerationLogEntry']> =
  rawModerationLogEntrySelector

export const marketplaceModerationLogEntrySelector = Selector('MarketplaceModerationLogEntry')(
  rawModerationLogEntrySelector,
)
