import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

/** Сколько дел ждёт администратора Образования — числа на пунктах меню. */
export const name = 'edubridgeAttention'

export const query = Selector('Query')({
  [name]: { teachers: true, learners: true },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
