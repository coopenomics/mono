import { documentSelector } from '../../selectors/common/documentSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeReturnStatement'

/**
 * Сформировать заявление о прекращении участия в программе «Образование».
 */
export const mutation = Selector('Mutation')({
  [name]: documentSelector,
})

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
