import { ledger2AdjustmentResultSelector } from '../../selectors/ledger2/ledger2AdjustmentResultSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'walmoveWallets'

/**
 * Перевод между кошельками одного бух.счёта (operation `o.adj.walmove`).
 * Только председатель. Backend проверяет связь wallet→account до подписания.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'WalmoveInput!') }, ledger2AdjustmentResultSelector],
})

export interface IInput {
  input: ModelTypes['WalmoveInput']
}

export interface IOutput {
  [name]: ModelTypes['Ledger2AdjustmentResult']
}
