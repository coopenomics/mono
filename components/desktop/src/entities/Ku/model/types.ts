import type { Queries } from '@coopenomics/sdk';

export type IKuDecisionsInput = Queries.Ku.GetDecisions.IInput;
export type IKuDecisionsResult = Queries.Ku.GetDecisions.IOutput[typeof Queries.Ku.GetDecisions.name];
export type IKuDecision = Queries.Ku.GetDecision.IOutput[typeof Queries.Ku.GetDecision.name];
export type IKuDecisionQuestion = NonNullable<IKuDecision['questions']>[number];
export type IKuTrustRequestsInput = Queries.Ku.GetTrustRequests.IInput;
export type IKuTrustRequestsResult = Queries.Ku.GetTrustRequests.IOutput[typeof Queries.Ku.GetTrustRequests.name];
export type IKuTrustRequest = IKuTrustRequestsResult['items'][number];
