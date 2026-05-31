import { Injectable, Inject, forwardRef } from '@nestjs/common';
import type { GenerateDocumentDomainInterfaceWithOptions } from '~/domain/document/interfaces/generate-document-domain-with-options.interface';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import type { GetDocumentsInputDomainInterface } from '~/domain/document/interfaces/get-documents-input-domain.interface';
import { DocumentPackageAggregator } from '~/domain/document/aggregators/document-package.aggregator';
import { DocumentAggregator } from '~/domain/document/aggregators/document.aggregator';
import type { DocumentAggregateDomainInterface } from '~/domain/document/interfaces/document-domain-aggregate.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import config from '~/config/config';

@Injectable()
export class DocumentInteractor {
  constructor(
    @Inject(forwardRef(() => DocumentDomainService)) private readonly documentDomainService: DocumentDomainService,
    @Inject(forwardRef(() => DocumentPackageAggregator))
    private readonly documentPackageAggregator: DocumentPackageAggregator,
    @Inject(forwardRef(() => DocumentAggregator)) private readonly documentAggregator: DocumentAggregator,
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly signedDocumentRepository: SignedDocumentRepository
  ) {}

  public async generateDocument(data: GenerateDocumentDomainInterfaceWithOptions): Promise<DocumentDomainEntity> {
    return await this.documentDomainService.generateDocument(data);
  }

  public async getDocumentsAggregate(
    data: GetDocumentsInputDomainInterface
  ): Promise<PaginationResultDomainInterface<DocumentPackageAggregateDomainInterface>> {
    const { type, page = 1, limit = 100, query = {}, after_block, before_block, actions } = data;

    // Read-path из PG-реестра подписанных документов (C28-21): отдаём ГОТОВЫЙ агрегат,
    // собранный на этапе ingestion/backfill — без обращений к explorer/Mongo и без сборки на лету.
    const result = await this.signedDocumentRepository.findAggregates({
      coopname: config.coopname,
      status: this.mapTypeToStatus(type),
      actions: actions && actions.length > 0 ? (actions as unknown as string[]) : undefined,
      username: this.extractReceiverScope(query),
      hash: this.extractHashFilter(query),
      afterBlock: after_block,
      beforeBlock: before_block,
      page,
      limit,
    });

    return {
      items: result.items,
      totalCount: result.total,
      totalPages: Math.ceil(result.total / limit) || 0,
      currentPage: page,
    };
  }

  // Прежний фильтр был по ИМЕНИ действия, не по статусу-партиции:
  //   «Все входящие» (newsubmitted) — у каждого пакета есть submitted-действие, поэтому это ВСЕ
  //     документы кооператива (решённые/аннулированные тоже входят) → статус НЕ ограничиваем;
  //   «Только утверждённые» (newresolved) — лишь решённые → status=Resolved.
  // (Партиция по статусу скрыла бы решённые документы из вкладки «Все входящие» — регрессия.)
  private mapTypeToStatus(type?: 'newsubmitted' | 'newresolved'): SignedDocumentStatus | undefined {
    return type === 'newresolved' ? SignedDocumentStatus.Resolved : undefined;
  }

  // Скоуп выборки повторяет прежний explorer-фильтр `receiver: username` из DocumentService.
  // Документ soviet через require_recipient уведомляет И кооператив, И пайщика-субъекта, поэтому:
  //   receiver === coopname → весь кооператив (фильтр только по coopname — как и было);
  //   receiver === <пайщик> → его документы (колонка username = субъект заявления).
  private extractReceiverScope(query: Record<string, unknown>): string | undefined {
    const receiver = query['receiver'];
    if (typeof receiver === 'string' && receiver.length > 0 && receiver !== config.coopname) {
      return receiver;
    }
    return undefined;
  }

  // Фильтр по конкретному документу: Union-страница шлёт filter.document.hash (upper-case).
  private extractHashFilter(query: Record<string, unknown>): string | undefined {
    const document = query['document'] as Record<string, unknown> | undefined;
    const hash = (document?.['hash'] ?? query['hash']) as unknown;
    return typeof hash === 'string' && hash.length > 0 ? hash : undefined;
  }

  /**
   * Получает документ по хэшу
   * @param hash Хэш документа
   * @returns Документ или null
   */
  async getDocumentByHash(hash: string): Promise<DocumentDomainEntity | null> {
    return await this.documentDomainService.getDocumentByHash(hash);
  }

  /**
   * Строит агрегат документа
   * @param signedDocument Подписанный документ
   * @returns Агрегат документа или null
   */
  async buildDocumentAggregate(
    signedDocument: ISignedDocumentDomainInterface | null | undefined
  ): Promise<DocumentAggregateDomainInterface | null> {
    if (!signedDocument) return null;

    return await this.documentAggregator.buildDocumentAggregate(signedDocument);
  }

}
