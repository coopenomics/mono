import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type OnboardingState = Queries.Chairman.GetOnboardingState.IOutput[typeof Queries.Chairman.GetOnboardingState.name];

const loadOnboardingState = async () => {
  const { [Queries.Chairman.GetOnboardingState.name]: state } = await client.Query(
    Queries.Chairman.GetOnboardingState.query,
  );
  return state;
};

const completeAgendaStep = async (
  data: Mutations.Chairman.CompleteOnboardingAgendaStep.IInput['data'],
) => {
  const { [Mutations.Chairman.CompleteOnboardingAgendaStep.name]: state } = await client.Mutation(
    Mutations.Chairman.CompleteOnboardingAgendaStep.mutation,
    {
      variables: { data },
    },
  );
  return state;
};

/** Председатель завершает онбординг: отметка в настройках кооператива. */
const completeOnboarding = async () => {
  const { [Mutations.System.CompleteCooperativeOnboarding.name]: settings } = await client.Mutation(
    Mutations.System.CompleteCooperativeOnboarding.mutation,
  );
  return settings;
};

export const api = {
  loadOnboardingState,
  completeAgendaStep,
  completeOnboarding,
};
