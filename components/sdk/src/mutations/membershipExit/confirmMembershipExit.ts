import { membershipExitResultSelector } from '../../selectors/membershipExit/membershipExitResultSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'confirmMembershipExit'

// Селектор мутации
export const mutation = Selector('Mutation')({
  [name]: [{ token: $('token', 'String!') }, membershipExitResultSelector],
})

// Интерфейс для входных данных
export interface IInput {
  token: string
}

// Тип выходных данных
export interface IOutput {
  [name]: ModelTypes['MembershipExitResult']
}
