import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type CapitalOnboardingState = Queries.Capital.GetOnboardingState.IOutput[typeof Queries.Capital.GetOnboardingState.name];

const loadOnboardingState = async () => {
  const { [Queries.Capital.GetOnboardingState.name]: state } = await client.Query(
    Queries.Capital.GetOnboardingState.query,
  );
  return state;
};

const completeStep = async (
  data: Mutations.Capital.CompleteOnboardingStep.IInput['data'],
) => {
  const { [Mutations.Capital.CompleteOnboardingStep.name]: state } = await client.Mutation(
    Mutations.Capital.CompleteOnboardingStep.mutation,
    {
      variables: { data },
    },
  );
  return state;
};

const saveProgramDocDataHash = async (
  data: Mutations.Capital.SaveCapitalProgramDocDataHash.IInput['data'],
) => {
  const { [Mutations.Capital.SaveCapitalProgramDocDataHash.name]: state } = await client.Mutation(
    Mutations.Capital.SaveCapitalProgramDocDataHash.mutation,
    {
      variables: { data },
    },
  );
  return state;
};

export const api = {
  loadOnboardingState,
  completeStep,
  saveProgramDocDataHash,
};
