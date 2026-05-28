import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceOnboardingState'

export const query = Selector('Query')({
  [name]: {
    requires_gate: true,
    template_registry_id: true,
    agreement_id: true,
    completed_at: true,
    source: true,
  },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
