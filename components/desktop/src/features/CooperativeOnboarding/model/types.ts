import type { Queries, Mutations } from '@coopenomics/sdk'

export type IExtensionOnboardingState = Queries.Onboarding.GetExtensionOnboardingState.IOutput[
  typeof Queries.Onboarding.GetExtensionOnboardingState.name
]

export type IExtensionOnboardingStepState = IExtensionOnboardingState['steps'][number]

export type ICompleteExtensionOnboardingStepInput =
  Mutations.Onboarding.CompleteExtensionOnboardingStep.IInput['data']
