import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Интерфейс данных одобрения из базы данных
 */
export interface IApprovalDatabaseData extends IBaseDatabaseData {
  // Специфические поля для approval
  approval_hash?: string; // Ключ синхронизации
  approved_document?: ISignedDocumentDomainInterface; // Одобренный документ (заполняется при подтверждении)
}
