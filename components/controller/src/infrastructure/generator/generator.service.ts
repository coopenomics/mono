// infrastructure/generator/generator.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import httpStatus from 'http-status';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { GenerateDocumentDomainInterfaceWithOptions } from '~/domain/document/interfaces/generate-document-domain-with-options.interface';
import { GeneratorPort } from '~/domain/document/ports/generator.port';
import { Generator, type ISearchResult } from '@coopenomics/factory';
import type { Cooperative } from 'cooptypes';
import config from '~/config/config';
import { HttpApiError } from '@coopenomics/extension-kit';
import { ControllerChainDataSource } from './controller-chain-data.source';
@Injectable()
export class GeneratorInfrastructureService implements GeneratorPort, OnModuleInit {
  /**
   * Фабрика получает данные цепи из базы узла, а не по HTTP из обозревателя
   * парсера: те же таблицы, действия и шаблоны узел уже хранит у себя.
   */
  private readonly generator: Generator;

  constructor(private readonly chainDataSource: ControllerChainDataSource) {
    this.generator = new Generator(this.chainDataSource);
  }

  async onModuleInit() {
    await this.connect(config.mongoose.url);
  }

  async connect(url: string): Promise<void> {
    await this.generator.connect(url);
  }

  async disconnect(): Promise<void> {
    await this.generator.disconnect();
  }

  async generate(
    data: Cooperative.Document.IGenerate,
    options?: Cooperative.Document.IGenerationOptions
  ): Promise<Cooperative.Document.IGeneratedDocument> {
    return await this.generator.generate(data, options);
  }

  async getDocument(query: {
    hash: string;
    block_num?: number;
  }): Promise<Cooperative.Document.IGeneratedDocument | null> {
    // Черновики версионируются по (hash + meta.block_num). При наличии
    // block_num тянем точную версию через dot-path mongo-фильтр, иначе —
    // любую версию с этим hash (легаси/превью).
    const filter: Record<string, unknown> = { hash: query.hash };
    if (query.block_num !== undefined && query.block_num !== null) {
      filter['meta.block_num'] = query.block_num;
    }
    return await this.generator.getDocument(filter as never);
  }

  async get<T = any>(collection: string, query: Record<string, any>): Promise<T | null> {
    return await (this.generator as any).get(collection as any, query);
  }

  async save(collection: string, data: any): Promise<void> {
    await (this.generator as any).save(collection as any, data);
  }

  async del(collection: string, query: Record<string, any>): Promise<void> {
    await (this.generator as any).del(collection as any, query);
  }

  async list<T = any>(collection: string, filter?: Record<string, any>): Promise<Cooperative.Document.IGetResponse<T>> {
    return await (this.generator as any).list(collection as any, filter);
  }

  async getHistory<T = any>(collection: string, filter: Record<string, any>): Promise<T[]> {
    return await (this.generator as any).getHistory(collection as any, filter);
  }

  async constructCooperative(username: string, block_num?: number): Promise<Cooperative.Model.ICooperativeData | null> {
    return await this.generator.constructCooperative(username, block_num);
  }

  async search(query: string): Promise<ISearchResult[]> {
    return await this.generator.search(query);
  }

  async saveDocData<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }> {
    return await this.generator.saveDocData(payload, registry_id);
  }

  async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    return await this.generator.getDocData<P>(hash);
  }

  async generateDocument(body: GenerateDocumentDomainInterfaceWithOptions): Promise<DocumentDomainEntity> {
    try {
      const generated = await this.generate(body.data, body.options);
      return new DocumentDomainEntity(generated);
    } catch (error) {
      console.error('Ошибка при генерации документа:', error);
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Ошибка при генерации документа');
    }
  }
}
