import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'changeProviderHostingPlan'

/**
 * Кооператив переходит на тариф сервера дороже: цена применяется немедленно
 * с зачётом неиспользованного остатка старого тарифа, провайдер запускает
 * перенос на сервер новой конфигурации — система уходит в технические работы
 * примерно на час. Доступно председателю; даунгрейд провайдер отклоняет.
 */
export const mutation = Selector('Mutation')({
  [name]: [
    { instanceTypeId: $('instanceTypeId', 'Int!') },
    {
      migration_state: true,
      new_price: true,
    },
  ],
})

export interface IInput {
  /** Конфигурация из каталога провайдера (server_options витрины) */
  instanceTypeId: number
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
