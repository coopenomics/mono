import type { SovietContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

export type PublishProjectFreeDecisionInputDomainInterface = Omit<
  SovietContract.Actions.Decisions.CreateFreeDecision.ICreateFreeDecision,
  'document'
> & {
  document: ISignedDocumentDomainInterface;
};
