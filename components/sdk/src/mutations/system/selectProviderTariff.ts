import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'selectProviderTariff'

/**
 * Кооператив-кандидат выбирает тариф подключения: провайдер по нему заказывает
 * сервер и заводит подписки (сервер, поддержка, приложение на выбор,
 * документооборот). Выбор делается за себя, до заявки в цепь.
 */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'SelectProviderTariffInput!') },
    {
      tariff_code: true,
      billing_period: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SelectProviderTariffInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
