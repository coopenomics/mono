import type { IGenerateBlank, IGeneratedBlank, ISearchResult } from '@coopenomics/docs-factory';
import type { Cooperative } from 'cooptypes';
import type { ICooperativeData, IGenerate, IGeneratedDocument, IGenerationOptions } from '@coopenomics/docs-templates';

export interface GeneratorPort {
  disconnect(): Promise<void>;
  generate(
    data: IGenerate,
    options?: IGenerationOptions
  ): Promise<IGeneratedDocument>;
  /**
   * Бланк документа: шаблон из цепи с реквизитами кооператива, поля без
   * данных события — прочерком. Не сохраняется и не подписывается.
   */
  generateBlank(data: IGenerateBlank): Promise<IGeneratedBlank>;
  getDocument(query: {
    hash: string;
    /** Точная версия черновика по meta.block_num (черновики версионируются
     * по hash+block_num). Не передан — вернётся любая версия с этим hash. */
    block_num?: number;
    /** Meta подписанного документа: точная версия, когда тело и блок у двух
     * генераций совпали. */
    meta?: unknown;
  }): Promise<IGeneratedDocument | null>;
  constructCooperative(username: string, block_num?: number): Promise<ICooperativeData | null>;
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
