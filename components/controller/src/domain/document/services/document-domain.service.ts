import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '../repository/document.repository';
import { GeneratorInfrastructureService } from '~/infrastructure/generator/generator.service';
import type { GenerateDocumentDomainInterfaceWithOptions } from '../interfaces/generate-document-domain-with-options.interface';
import { DocumentDomainEntity } from '../entity/document-domain.entity';
import { Cooperative, SovietContract } from 'cooptypes';
import { DocumentDomainAggregate } from '../aggregates/document-domain.aggregate';
import { DocumentAggregator } from '../aggregators/document.aggregator';
import { DocumentPackageAggregator } from '../aggregators/document-package.aggregator';
import { getActions } from '~/utils/getFetch';
import { toDotNotation } from '~/utils/toDotNotation';
import type { ISignedDocumentDomainInterface } from '../interfaces/signed-document-domain.interface';

@Injectable()
export class DocumentDomainService {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documentRepository: DocumentRepository,
    private readonly generatorInfrastructureService: GeneratorInfrastructureService,
    @Inject(forwardRef(() => DocumentAggregator)) private readonly documentAggregator: DocumentAggregator,
    @Inject(forwardRef(() => DocumentPackageAggregator))
    private readonly documentPackageAggregator: DocumentPackageAggregator
  ) {}

  public async generateDocument(data: GenerateDocumentDomainInterfaceWithOptions): Promise<DocumentDomainEntity> {
    return await this.generatorInfrastructureService.generateDocument(data);
  }

  public async saveDocData<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }> {
    return await this.generatorInfrastructureService.saveDocData(payload, registry_id);
  }

  public async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    return await this.generatorInfrastructureService.getDocData<P>(hash);
  }

  public async getDocumentByHash(hash: string): Promise<DocumentDomainEntity | null> {
    const document = await this.documentRepository.findByHash(hash);
    return document;
  }

  /**
   * Создает агрегатор документов на основе полного документа и подписанного документа
   * Делегирует выполнение к DocumentAggregator
   * @param signedDoc Подписанный документ (метаинформация)
   * @returns Агрегатор документов
   */
  public async buildDocumentAggregate(signedDoc: ISignedDocumentDomainInterface): Promise<DocumentDomainAggregate | null> {
    return this.documentAggregator.buildDocumentAggregate(signedDoc);
  }

  /**
   * Получает неизменяемые подписанные документы (immutable signed documents) из блокчейна
   */
  public async getImmutableSignedDocuments(data: {
    type?: string;
    query: Record<string, unknown>;
    page?: number;
    limit?: number;
  }): Promise<Cooperative.Blockchain.IGetActions> {
    const { type = 'newsubmitted', page = 1, limit = 100, query } = data;

    const response = await getActions(`${process.env.SIMPLE_EXPLORER_API}/get-actions`, {
      filter: JSON.stringify({
        account: SovietContract.contractName.production,
        name: type,
        ...toDotNotation(query),
      }),
      page,
      limit,
    });

    return response;
  }
}
