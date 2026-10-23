import { rawSettingsSelector } from '../../selectors/system/systemInfoSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'completeCooperativeOnboarding'

/** Председатель завершает онбординг: пункт «Онбординг» уходит из меню */
export const mutation = Selector('Mutation')({
  [name]: rawSettingsSelector,
})

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
