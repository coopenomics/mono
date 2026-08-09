import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Интерфейс данных приложения из блокчейна
 */
export type IAppendixBlockchainData = Omit<CapitalContract.Tables.Appendixes.IAppendix, 'appendix'> & {
  appendix: ISignedDocumentDomainInterface;
};
