import { membershipExitResultSelector } from '../../selectors/membershipExit/membershipExitResultSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'createMembershipExit'

// Селектор мутации
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateMembershipExitInput!') }, membershipExitResultSelector],
})

// Интерфейс для входных данных
export interface IInput {
  data: ModelTypes['CreateMembershipExitInput']
}

// Тип выходных данных
export interface IOutput {
  [name]: ModelTypes['MembershipExitResult']
}
