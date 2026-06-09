import { createCooperativeInvestmentResponseSelector } from '../../selectors/wallet/createCooperativeInvestmentResponseSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'createCooperativeInvestment'

// Селектор мутации
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateCooperativeInvestmentInput!') }, createCooperativeInvestmentResponseSelector],
})

// Интерфейс для входных данных
export interface IInput {
  data: ModelTypes['CreateCooperativeInvestmentInput']
}

// Тип выходных данных
export interface IOutput {
  [name]: ModelTypes['CreateCooperativeInvestmentResponse']
}
