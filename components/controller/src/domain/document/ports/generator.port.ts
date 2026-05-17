import type { ISearchResult } from '@coopenomics/factory';
import type { Cooperative } from 'cooptypes';

export interface GeneratorPort {
  connect(url: string): Promise<void>;
  disconnect(): Promise<void>;
  generate(
    data: Cooperative.Document.IGenerate,
    options?: Cooperative.Document.IGenerationOptions
  ): Promise<Cooperative.Document.IGeneratedDocument>;
  getDocument(query: { hash: string }): Promise<Cooperative.Document.IGeneratedDocument | null>;
  constructCooperative(username: string, block_num?: number): Promise<Cooperative.Model.ICooperativeData | null>;
  get<T = any>(collection: string, query: Record<string, any>): Promise<T | null>;
  save(collection: string, data: any): Promise<void>;
  del(collection: string, query: Record<string, any>): Promise<void>;
  list<T = any>(collection: string, filter?: Record<string, any>): Promise<Cooperative.Document.IGetResponse<T>>;
  getHistory<T = any>(collection: string, filter: Record<string, any>): Promise<T[]>;
  search(query: string): Promise<ISearchResult[]>;

  saveDocData<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }>;

  getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null>;
}

export const GENERATOR_PORT = Symbol('GeneratorPort');
