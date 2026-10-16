import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'changeProviderTariff'

/**
 * Кооператив переходит на тариф подключения дороже: провайдер переоценивает
 * сервер, поддержку, приложение и пакет документооборота с зачётом остатка;
 * если тарифу нужен другой сервер — запускает перенос (около часа
 * технических работ). Доступно председателю.
 */
export const mutation = Selector('Mutation')({
  [name]: [
    { tariffCode: $('tariffCode', 'String!') },
    {
      migration_state: true,
      monthly_total: true,
      annual_total: true,
    },
  ],
})

export interface IInput {
  /** Код тарифа из тарифной сетки провайдера */
  tariffCode: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
