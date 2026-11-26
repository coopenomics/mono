import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'setAppsPackagePricing'

/** Назначить цену своему пакету: рубли в месяц и пробный срок (487-31). */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'SetAppsPackagePricingInput!') },
    { packageId: true, rubPerMonth: true, trialDays: true, lastActiveVersion: true, updatedAt: true },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetAppsPackagePricingInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
