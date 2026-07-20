import { $, Selector } from '../../zeus/index'

export const name = 'cancelMembershipExit'

// Селектор мутации (возвращает скаляр Boolean)
export const mutation = Selector('Mutation')({
  [name]: [{ coopname: $('coopname', 'String!'), username: $('username', 'String!') }, true],
})

// Интерфейс для входных данных
export interface IInput {
  coopname: string
  username: string
}

// Тип выходных данных
export interface IOutput {
  [name]: boolean
}
