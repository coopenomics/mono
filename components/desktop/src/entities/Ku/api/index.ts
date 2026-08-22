import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type {
  IKuDecision,
  IKuDecisionsInput,
  IKuDecisionsResult,
  IKuTrustRequestsInput,
  IKuTrustRequestsResult,
} from '../model/types';

async function loadDecisions(data: IKuDecisionsInput): Promise<IKuDecisionsResult> {
  const { [Queries.Ku.GetDecisions.name]: result } = await client.Query(Queries.Ku.GetDecisions.query, {
    variables: data,
  });
  return result;
}

async function loadDecision(hash: string): Promise<IKuDecision> {
  const { [Queries.Ku.GetDecision.name]: result } = await client.Query(Queries.Ku.GetDecision.query, {
    variables: { hash },
  });
  return result;
}

async function loadTrustRequests(data: IKuTrustRequestsInput): Promise<IKuTrustRequestsResult> {
  const { [Queries.Ku.GetTrustRequests.name]: result } = await client.Query(Queries.Ku.GetTrustRequests.query, {
    variables: data,
  });
  return result;
}

export const api = {
  loadDecisions,
  loadDecision,
  loadTrustRequests,
};
