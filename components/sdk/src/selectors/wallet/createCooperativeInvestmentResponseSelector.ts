import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Сырой селектор для CreateCooperativeInvestmentResponse
export const rawCreateCooperativeInvestmentResponseSelector = {
  invest_hash: true,
}

// Валидация селектора
const _validate: MakeAllFieldsRequired<ValueTypes['CreateCooperativeInvestmentResponse']> =
  rawCreateCooperativeInvestmentResponseSelector

/**
 * Селектор для ответа создания заявки кооператива на инвестирование в ЦПП оператора
 */
export const createCooperativeInvestmentResponseSelector = Selector('CreateCooperativeInvestmentResponse')(
  rawCreateCooperativeInvestmentResponseSelector,
)

export type CreateCooperativeInvestmentResponseType = ModelTypes['CreateCooperativeInvestmentResponse']
