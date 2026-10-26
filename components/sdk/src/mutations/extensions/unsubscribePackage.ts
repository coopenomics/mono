import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'unsubscribePackage'

/**
 * Отмена подписки кооператива на приложение каталога: провайдер снимает
 * строку счёта, каталог закрывает доступ к пакету.
 */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'SubscribePackageInputDTO!') },
    {
      status: true,
      packageId: true,
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
