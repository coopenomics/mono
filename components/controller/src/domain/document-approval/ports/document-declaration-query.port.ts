import type { InnerDocumentDeclaration } from '@coopenomics/innercoop';

/**
 * Чтение реестра шаблонов кооператива: что объявили ядро и установленные
 * приложения. Пишут в реестр через порт `DOCUMENT_DECLARATION_PORT` из
 * `@coopenomics/innercoop`, читает — ядро.
 */
export interface DocumentDeclarationQueryPort {
  getAll(): InnerDocumentDeclaration[];
  getByExtension(extension_name: string): InnerDocumentDeclaration[];
  getByRegistryId(registry_id: number): InnerDocumentDeclaration | null;
  getByBundle(extension_name: string, bundle: string): InnerDocumentDeclaration[];
}

export const DOCUMENT_DECLARATION_QUERY_PORT = Symbol('DocumentDeclarationQueryPort');
