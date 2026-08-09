import type { Mutations } from '@coopenomics/sdk';

export type ICreateKuDecisionInput = Mutations.Ku.CreateDecision.IInput['data'];
export type IJoinKuDecisionInput = Mutations.Ku.JoinDecision.IInput['data'];
export type IStartKuDecisionInput = Mutations.Ku.StartDecision.IInput['data'];
export type IVoteOnKuDecisionInput = Mutations.Ku.VoteOnDecision.IInput['data'];
export type ICloseKuDecisionInput = Mutations.Ku.CloseDecision.IInput['data'];
export type IExecKuDecisionInput = Mutations.Ku.ExecDecision.IInput['data'];
export type ICancelKuDecisionInput = Mutations.Ku.CancelDecision.IInput['data'];

export type KuVote = 'for' | 'against' | 'abstained';

export interface IKuAgendaPointDraft {
  title: string;
  decision: string;
  context: string;
}
