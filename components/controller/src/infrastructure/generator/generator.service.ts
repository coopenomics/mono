// infrastructure/generator/generator.service.ts
import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import httpStatus from 'http-status';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { GenerateDocumentDomainInterfaceWithOptions } from '~/domain/document/interfaces/generate-document-domain-with-options.interface';
import { GeneratorPort } from '~/domain/document/ports/generator.port';
import { Generator, UnknownDocumentFactoryError, type IGenerateBlank, type IGeneratedBlank, type ISearchResult } from '@coopenomics/factory';
import type { Cooperative } from 'cooptypes';
import config from '~/config/config';
import { DomainError } from '@coopenomics/extension-kit';
import { ControllerChainDataSource } from './controller-chain-data.source';
import { ChainChangesService } from '~/infrastructure/blockchain/chain-changes.service';

/**
 * Коллекции генератора (MongoDB) и их имена в ленте изменений. Личные данные
 * пайщика, способы оплаты и переменные кооператива живут не в Postgres —
 * подписчик базы узла их не видит, поэтому сигнал шлёт этот сервис после
 * записи. Имена объявлены в `chain-changes.service.ts`.
 */
const GENERATOR_FEED_TABLES: Record<string, string> = {
  individual: 'private_accounts',
  organization: 'private_accounts',
  entrepreneur: 'private_accounts',
  paymentMethod: 'payment_methods',
  udata: 'user_data',
  vars: 'coop_vars',
};
@Injectable()
export class GeneratorInfrastructureService implements GeneratorPort, OnModuleInit {
  /**
   * Фабрика получает данные цепи из базы узла, а не по HTTP из обозревателя
   * парсера: те же таблицы, действия и шаблоны узел уже хранит у себя.
   */
  private readonly generator: Generator;

  constructor(
    private readonly chainDataSource: ControllerChainDataSource,
    @Optional() @Inject(ChainChangesService) private readonly feed: ChainChangesService | null = null
  ) {
    this.generator = new Generator(this.chainDataSource);
  }

  /** Сигнал ленты после записи в коллекцию с личными данными или переменными. */
  private signal(collection: string, data: Record<string, unknown> | undefined): void {
    const table = GENERATOR_FEED_TABLES[collection];
    if (!table) return;
    void this.feed?.publishLocal(table, String(data?.username ?? data?.coopname ?? ''), data);
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

  async generateBlank(data: IGenerateBlank): Promise<IGeneratedBlank> {
    try {
      return await this.generator.generateBlank(data);
    } catch (error) {
      console.error('Ошибка при сборке бланка документа:', error);
      const wrapped = DomainError.badRequest('GENERATOR_BLANK_ASSEMBLY_FAILED');
      Object.defineProperty(wrapped, 'cause', { value: error, enumerable: false, configurable: true, writable: true });
      throw wrapped;
    }
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
    this.signal(collection, data);
  }

  async del(collection: string, query: Record<string, any>): Promise<void> {
    await (this.generator as any).del(collection as any, query);
    this.signal(collection, query);
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
      // Документ, для которого нет фабрики, — неверный запрос с понятным кодом;
      // до 25.09.2026 причина оставалась только в журнале (C28-80).
      if (error instanceof UnknownDocumentFactoryError) {
        throw DomainError.badRequest('GENERATOR_DOCUMENT_TYPE_UNKNOWN', { registryId: error.registry_id });
      }
      console.error('Ошибка при генерации документа:', error);
      // Исходная ошибка фабрики остаётся причиной: по ней вызывающий различает
      // отказы (робот совета так узнаёт отставание индекса голосов). Свойство
      // неперечисляемое — в ответы API и сериализацию ошибки оно не попадает.
      const wrapped = DomainError.badRequest('GENERATOR_DOCUMENT_GENERATION_FAILED');
      Object.defineProperty(wrapped, 'cause', { value: error, enumerable: false, configurable: true, writable: true });
      throw wrapped;
    }
  }
}
