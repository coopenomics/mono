import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawReturnBalanceSelector = { available: true, refunds: true, total: true, subscriptions: true }
const _validateReturnBalance: MakeAllFieldsRequired<ValueTypes['EduReturnBalance']> = rawReturnBalanceSelector
export const eduReturnBalanceSelector = Selector('EduReturnBalance')(rawReturnBalanceSelector)
