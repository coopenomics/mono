import type { SovietContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

export type SelectBranchInputDomainInterface = Omit<
  SovietContract.Actions.Branches.SelectBranch.ISelectBranch,
  'document'
> & {
  document: ISignedDocument;
};
