import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateCustomCategory'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'CreateCustomCategoryInput!') },
    {
      id: true,
      display_name: true,
      sort_order: true,
      mvp_baseline: true,
    },
  ],
})

export interface IInput {
  [key: string]: unknown
  input: ModelTypes['CreateCustomCategoryInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
