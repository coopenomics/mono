import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  IApproveKuTrustedInput,
  IDeclineKuTrustedInput,
  IRequestKuTrustedInput,
} from '../model/types';

async function requestTrusted(data: IRequestKuTrustedInput) {
  const { [Mutations.Ku.RequestTrusted.name]: result } = await client.Mutation(Mutations.Ku.RequestTrusted.mutation, {
    variables: { data },
  });
  return result;
}

async function approveTrusted(data: IApproveKuTrustedInput) {
  const { [Mutations.Ku.ApproveTrusted.name]: result } = await client.Mutation(Mutations.Ku.ApproveTrusted.mutation, {
    variables: { data },
  });
  return result;
}

async function declineTrusted(data: IDeclineKuTrustedInput) {
  const { [Mutations.Ku.DeclineTrusted.name]: result } = await client.Mutation(Mutations.Ku.DeclineTrusted.mutation, {
    variables: { data },
  });
  return result;
}

export const api = {
  requestTrusted,
  approveTrusted,
  declineTrusted,
};
