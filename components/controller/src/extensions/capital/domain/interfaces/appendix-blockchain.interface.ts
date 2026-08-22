import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных приложения из блокчейна
 */
export type IAppendixBlockchainData = Omit<CapitalContract.Tables.Appendixes.IAppendix, 'appendix'> & {
  appendix: ISignedDocument;
};
