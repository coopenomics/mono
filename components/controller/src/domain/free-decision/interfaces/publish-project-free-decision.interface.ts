import type { SovietContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

export type PublishProjectFreeDecisionInputDomainInterface = Omit<
  SovietContract.Actions.Decisions.CreateFreeDecision.ICreateFreeDecision,
  'document'
> & {
  document: ISignedDocument;
};
