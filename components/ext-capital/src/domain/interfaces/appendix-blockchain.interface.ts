import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных приложения из блокчейна
 */
export type IAppendixBlockchainData = Omit<CapitalContract.Tables.Appendixes.IAppendix, 'appendix'> & {
  appendix: ISignedDocumentDomainInterface;
};
