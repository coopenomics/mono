import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных программного имущественного взноса из блокчейна
 */
export type IProgramPropertyBlockchainData = Omit<
  CapitalContract.Tables.ProgramProperties.IProgramProperty,
  'statement' | 'authorization' | 'act'
> & {
  statement: ISignedDocument;
  authorization: ISignedDocument;
  act: ISignedDocument;
};
