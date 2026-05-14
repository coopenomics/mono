import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/**
 * Селектор Ledger2AdjustmentResult — ответ мутаций walmoveWallets / revertOperation.
 * processHash — общий якорь записей корректировки (action + walletop + опц. debit/credit).
 */
export const rawLedger2AdjustmentResultSelector = {
  processHash: true,
  transactionId: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['Ledger2AdjustmentResult']> = rawLedger2AdjustmentResultSelector

export const ledger2AdjustmentResultSelector = Selector('Ledger2AdjustmentResult')(
  rawLedger2AdjustmentResultSelector,
)

export type Ledger2AdjustmentResultType = ModelTypes['Ledger2AdjustmentResult']
