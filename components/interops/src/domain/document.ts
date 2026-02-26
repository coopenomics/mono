/**
 * Доменные интерфейсы документов — порты для генерации и хранения документов
 */

export interface ISignedDocumentDomain {
  hash: string;
  public_key: string;
  signature: string;
  meta: IDocumentMetaDomain;
}

export interface IDocumentMetaDomain {
  title: string;
  registry_id?: number;
  coopname: string;
  username: string;
  lang: string;
  generator?: string;
  version?: string;
  created_at?: string;
}

export interface IGeneratedDocumentDomain {
  hash: string;
  html: string;
  meta: IDocumentMetaDomain;
  binary?: any;
}

export interface IDocumentDataPort {
  getDocument(hash: string): Promise<any | null>;
  getDocuments(filter: any, options?: any): Promise<any>;
}

export const DOCUMENT_DATA_PORT = Symbol('DocumentDataPort');

export interface IDocumentRepository {
  findByHash(hash: string): Promise<any | null>;
  save(document: any): Promise<void>;
}

export const DOCUMENT_REPOSITORY = Symbol('DocumentRepository');

export interface IResultContributionStatementDocument {
  registry_id: number;
  coopname: string;
  username: string;
  lang: string;
  project_id: string;
  result_hash: string;
}
