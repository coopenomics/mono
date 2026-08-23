import type { Cooperative } from 'cooptypes';

/**
 * Узкая задача пред-генерации: документ, у которого часть полей приватна и
 * хранится off-chain (`doc_data`) — `DocumentDomainService.generateDocument`
 * сохраняет `doc_data` через `saveDocData` и публикует дальше только
 * `doc_data_hash`. См. `Cooperative.Document.IDocDataRef` в cooptypes —
 * on-chain-сторона того же контракта.
 */
export interface GenerateDocumentWithPrivateDataDomainInterface extends Cooperative.Document.IGenerate {
  doc_data?: Record<string, unknown>;
  doc_data_hash?: string;
}
