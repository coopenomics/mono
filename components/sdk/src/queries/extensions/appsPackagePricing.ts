import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'appsPackagePricing'

/**
 * Пакеты своего кооператива в каталоге приложений и их цены (487-31).
 * Цену назначает издатель; `rubPerMonth: null` — цена не назначена.
 */
export const query = Selector('Query')({
  [name]: { packageId: true, rubPerMonth: true, trialDays: true, lastActiveVersion: true, inCatalog: true, updatedAt: true },
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
