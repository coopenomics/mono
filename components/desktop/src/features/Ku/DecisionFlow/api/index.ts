import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  ICancelKuDecisionInput,
  ICloseKuDecisionInput,
  ICreateKuDecisionInput,
  IExecKuDecisionInput,
  IJoinKuDecisionInput,
  IStartKuDecisionInput,
  IVoteOnKuDecisionInput,
} from '../model/types';

async function createDecision(data: ICreateKuDecisionInput) {
  const { [Mutations.Ku.CreateDecision.name]: result } = await client.Mutation(Mutations.Ku.CreateDecision.mutation, {
    variables: { data },
  });
  return result;
}

async function joinDecision(data: IJoinKuDecisionInput) {
  const { [Mutations.Ku.JoinDecision.name]: result } = await client.Mutation(Mutations.Ku.JoinDecision.mutation, {
    variables: { data },
  });
  return result;
}

async function startDecision(data: IStartKuDecisionInput) {
  const { [Mutations.Ku.StartDecision.name]: result } = await client.Mutation(Mutations.Ku.StartDecision.mutation, {
    variables: { data },
  });
  return result;
}

async function voteOnDecision(data: IVoteOnKuDecisionInput) {
  const { [Mutations.Ku.VoteOnDecision.name]: result } = await client.Mutation(Mutations.Ku.VoteOnDecision.mutation, {
    variables: { data },
  });
  return result;
}

async function closeDecision(data: ICloseKuDecisionInput) {
  const { [Mutations.Ku.CloseDecision.name]: result } = await client.Mutation(Mutations.Ku.CloseDecision.mutation, {
    variables: { data },
  });
  return result;
}

async function execDecision(data: IExecKuDecisionInput) {
  const { [Mutations.Ku.ExecDecision.name]: result } = await client.Mutation(Mutations.Ku.ExecDecision.mutation, {
    variables: { data },
  });
  return result;
}

async function cancelDecision(data: ICancelKuDecisionInput) {
  const { [Mutations.Ku.CancelDecision.name]: result } = await client.Mutation(Mutations.Ku.CancelDecision.mutation, {
    variables: { data },
  });
  return result;
}

export const api = {
  createDecision,
  joinDecision,
    startDecision,
  voteOnDecision,
  closeDecision,
  execDecision,
  cancelDecision,
};
