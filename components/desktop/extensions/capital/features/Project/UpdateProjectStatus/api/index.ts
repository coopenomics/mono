import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

export type IStartProjectInput = Mutations.Capital.StartProject.IInput['data'];
export type IStartProjectOutput =
  Mutations.Capital.StartProject.IOutput[typeof Mutations.Capital.StartProject.name];

export type IStopProjectInput = Mutations.Capital.StopProject.IInput['data'];
export type IStopProjectOutput =
  Mutations.Capital.StopProject.IOutput[typeof Mutations.Capital.StopProject.name];

export type IStartVotingInput = Mutations.Capital.StartVoting.IInput['data'];
export type IStartVotingOutput =
  Mutations.Capital.StartVoting.IOutput[typeof Mutations.Capital.StartVoting.name];

export type ICloseProjectInput = Mutations.Capital.CloseProject.IInput['data'];
export type ICloseProjectOutput =
  Mutations.Capital.CloseProject.IOutput[typeof Mutations.Capital.CloseProject.name];

export type ICompleteVotingInput =
  Mutations.Capital.CompleteVoting.IInput['data'];
export type ICompleteVotingOutput =
  Mutations.Capital.CompleteVoting.IOutput[typeof Mutations.Capital.CompleteVoting.name];

export type IFinalizeProjectInput = Mutations.Capital.FinalizeProject.IInput['data'];
export type IFinalizeProjectOutput =
  Mutations.Capital.FinalizeProject.IOutput[typeof Mutations.Capital.FinalizeProject.name];

async function startProject(
  data: IStartProjectInput,
): Promise<IStartProjectOutput> {
  console.log('startProject', data);
  const { [Mutations.Capital.StartProject.name]: result } =
    await client.Mutation(Mutations.Capital.StartProject.mutation, {
      variables: {
        data,
      },
    });

  return result;
}

async function stopProject(
  data: IStopProjectInput,
): Promise<IStopProjectOutput> {
  const { [Mutations.Capital.StopProject.name]: result } =
    await client.Mutation(Mutations.Capital.StopProject.mutation, {
      variables: {
        data,
      },
    });

  return result;
}

async function startVoting(
  data: IStartVotingInput,
): Promise<IStartVotingOutput> {
  const { [Mutations.Capital.StartVoting.name]: result } =
    await client.Mutation(Mutations.Capital.StartVoting.mutation, {
      variables: {
        data,
      },
    });

  return result;
}

async function closeProject(
  data: ICloseProjectInput,
): Promise<ICloseProjectOutput> {
  const { [Mutations.Capital.CloseProject.name]: result } =
    await client.Mutation(Mutations.Capital.CloseProject.mutation, {
      variables: {
        data,
      },
    });

  return result;
}

async function completeVoting(
  data: ICompleteVotingInput,
): Promise<ICompleteVotingOutput> {
  const { [Mutations.Capital.CompleteVoting.name]: result } =
    await client.Mutation(Mutations.Capital.CompleteVoting.mutation, {
      variables: {
        data,
      },
    });

  return result;
}

async function finalizeProject(
  data: IFinalizeProjectInput,
): Promise<IFinalizeProjectOutput> {
  const { [Mutations.Capital.FinalizeProject.name]: result } =
    await client.Mutation(Mutations.Capital.FinalizeProject.mutation, {
      variables: {
        data,
      },
    });

  return result;
}

export const api = {
  startProject,
  stopProject,
  startVoting,
  closeProject,
  completeVoting,
  finalizeProject,
};
