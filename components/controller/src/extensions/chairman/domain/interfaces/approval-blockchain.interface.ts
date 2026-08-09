import type { SovietContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Интерфейс данных одобрения из блокчейна
 */
export type IApprovalBlockchainData = Omit<SovietContract.Tables.Approvals.IApproval, 'document'> & {
  document: ISignedDocumentDomainInterface;
};
