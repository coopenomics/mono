import { accountSelector } from '../../selectors'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'resetRegistration'

// Мутация без аргументов: бэкенд берёт пайщика из токена (self-scoped),
// откатывая его собственную незавершённую регистрацию к редактированию данных.
export const mutation = Selector('Mutation')({
  [name]: accountSelector,
})

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
