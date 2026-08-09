import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных результата из блокчейна
 */
export type IResultBlockchainData = Omit<CapitalContract.Tables.Results.IResult, 'statement' | 'authorization' | 'act'> & {
  statement: ISignedDocument;
  authorization: ISignedDocument;
  act: ISignedDocument;
};
