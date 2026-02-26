import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных программного имущественного взноса из блокчейна
 */
export type IProgramPropertyBlockchainData = Omit<
  CapitalContract.Tables.ProgramProperties.IProgramProperty,
  'statement' | 'authorization' | 'act'
> & {
  statement: ISignedDocumentDomainInterface;
  authorization: ISignedDocumentDomainInterface;
  act: ISignedDocumentDomainInterface;
};
