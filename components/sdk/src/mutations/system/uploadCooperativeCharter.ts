import { rawCooperativeCharterSelector } from '../../selectors/system/cooperativeCharterSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'uploadCooperativeCharter'

/**
 * Приложить устав кооператива к заявке на подключение к платформе.
 * Файл едет base64 внутри мутации, бинарь ложится в бакет `registrator:charters`.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UploadCooperativeCharterInput!') }, rawCooperativeCharterSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UploadCooperativeCharterInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
