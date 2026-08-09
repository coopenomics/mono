import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Интерфейс данных результата из блокчейна
 */
export type IResultBlockchainData = Omit<CapitalContract.Tables.Results.IResult, 'statement' | 'authorization' | 'act'> & {
  statement: ISignedDocumentDomainInterface;
  authorization: ISignedDocumentDomainInterface;
  act: ISignedDocumentDomainInterface;
};
