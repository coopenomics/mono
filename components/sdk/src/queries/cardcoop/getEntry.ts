import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'cardcoopEntry'

/** Состав сессии входа: кто вошёл и на каком шаге быстрая регистрация. */
export const entrySelector = Selector('CardcoopEntry')({
  id: true,
  outcome: true,
  status: true,
  cardNumber: true,
  username: true,
  memberships: {
    coopname: true,
    displayName: true,
    memberSince: true,
  },
  // Адрес сети нужен странице ожидания: кабинет карты человек не открывал — он пришёл
  // переходом, и без ссылки ему некуда нажать, чтобы подтвердить перенос.
  networkUrl: true,
})

/**
 * Сессия входа по карте пайщика.
 *
 * Право доступа — сам идентификатор: случайный UUID, который знает только браузер,
 * вернувшийся из card.coop.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'CardcoopEntryInput!') }, entrySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CardcoopEntryInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
