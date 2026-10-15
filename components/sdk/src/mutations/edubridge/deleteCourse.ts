import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeDeleteCourse'

/** Удалить курс без подписок и занятий */
export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'ID!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
