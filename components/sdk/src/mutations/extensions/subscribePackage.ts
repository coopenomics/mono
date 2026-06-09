import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'subscribePackage'

/**
 * Активация подписки кооператива на пакет каталога (Story 9.3.b-sub).
 * Backend-прокси зовёт ca-auth `POST /v1/subscriptions/activate` —
 * первый раз подписка trial (если доступен), дальше платная.
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
