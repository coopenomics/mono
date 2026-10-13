import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCancelGroupUnderfilled'

/** Отменить группу по недобору: подписки группы закрываются, взносы возвращаются участникам на паевой */
export const mutation = Selector('Mutation')({
  [name]: [{ group_id: $('group_id', 'ID!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  group_id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
