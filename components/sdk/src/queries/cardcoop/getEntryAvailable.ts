import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'cardcoopEntryAvailable'

/**
 * Доступен ли вход по карте пайщика в этом кооперативе.
 *
 * Публичный запрос: его задаёт экран входа до всякой авторизации — человек ещё только
 * решает, как войти.
 */
export const query = Selector('Query')({
  [name]: true,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
