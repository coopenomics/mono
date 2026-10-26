import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'subscribePackage'

/**
 * Подписка кооператива на приложение каталога у провайдера подключения:
 * с пробным сроком из публикации стартует пробной, иначе платной.
 */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'SubscribePackageInputDTO!') },
    {
      status: true,
      packageId: true,
      state: true,
      plan: true,
      startAt: true,
      endAt: true,
      freeTrialUsed: true,
      error: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SubscribePackageInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
