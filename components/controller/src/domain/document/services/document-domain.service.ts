import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '../repository/document.repository';
import { GeneratorInfrastructureService } from '~/infrastructure/generator/generator.service';
import type { GenerateDocumentDomainInterfaceWithOptions } from '../interfaces/generate-document-domain-with-options.interface';
import { DocumentDomainEntity } from '../entity/document-domain.entity';
import { Cooperative, SovietContract } from 'cooptypes';
import { DocumentDomainAggregate } from '../aggregates/document-domain.aggregate';
import { DocumentAggregator } from '../aggregators/document.aggregator';
import { DocumentPackageAggregator } from '../aggregators/document-package.aggregator';
import { BlockchainActionHistoryService } from '~/domain/parser/services/blockchain-action-history.service';
import { toDotNotation } from '~/utils/toDotNotation';
import type { ISignedDocument } from '@coopenomics/innercoop';
import type { GenerateDocumentWithPrivateDataDomainInterface } from '../interfaces/generate-document-with-private-data.interface';

@Injectable()
export class DocumentDomainService {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documentRepository: DocumentRepository,
    private readonly generatorInfrastructureService: GeneratorInfrastructureService,
    // `forwardRef` снят: циклов в узле документов нет (FC1-18).
    @Inject(DocumentAggregator) private readonly documentAggregator: DocumentAggregator,
    @Inject(DocumentPackageAggregator)
    private readonly documentPackageAggregator: DocumentPackageAggregator,
    private readonly actionHistory: BlockchainActionHistoryService
  ) {}

  public async generateDocument(data: GenerateDocumentDomainInterfaceWithOptions): Promise<DocumentDomainEntity> {
    const documentData: GenerateDocumentWithPrivateDataDomainInterface = data.data;

    if (documentData.doc_data) {
      const { doc_data, ...publicDocumentData } = documentData;
      const { hash } = documentData.doc_data_hash
        ? { hash: documentData.doc_data_hash }
        : await this.saveDocData(doc_data, documentData.registry_id);

      return await this.generatorInfrastructureService.generateDocument({
        ...data,
        data: {
          ...publicDocumentData,
          doc_data_hash: hash,
        },
      });
    }

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
  public async buildDocumentAggregate(signedDoc: ISignedDocument): Promise<DocumentDomainAggregate | null> {
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

    return this.actionHistory.findByQuery(
      { account: SovietContract.contractName.production, name: type },
      toDotNotation(query),
      page,
      limit
    );
  }
}
