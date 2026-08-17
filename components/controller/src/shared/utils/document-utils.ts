import { EMPTY_HASH, DEFAULT_DOCUMENT_VERSION } from '@coopenomics/extension-kit';

/**
 * Создает пустой документ с нулевым хэшем
 */
export function createEmptyDocument() {
  return {
    version: DEFAULT_DOCUMENT_VERSION,
    hash: EMPTY_HASH,
    doc_hash: EMPTY_HASH,
    meta_hash: EMPTY_HASH,
    meta: '',
    signatures: []
  };
}