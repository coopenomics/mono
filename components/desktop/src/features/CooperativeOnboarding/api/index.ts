import { client } from 'src/shared/api/client'
import { Queries, Mutations } from '@coopenomics/sdk'
import type {
  IExtensionOnboardingState,
  ICompleteExtensionOnboardingStepInput,
} from '../model/types'

export async function fetchExtensionOnboardingState(
  extension_name: string
): Promise<IExtensionOnboardingState> {
  const result = await client.Query(
    Queries.Onboarding.GetExtensionOnboardingState.query,
    { variables: { extension_name } }
  )
  return result[Queries.Onboarding.GetExtensionOnboardingState.name]
}

export async function completeExtensionOnboardingStep(
  data: ICompleteExtensionOnboardingStepInput
): Promise<IExtensionOnboardingState> {
  const result = await client.Mutation(
    Mutations.Onboarding.CompleteExtensionOnboardingStep.mutation,
    { variables: { data } }
  )
  return result[Mutations.Onboarding.CompleteExtensionOnboardingStep.name]
}
