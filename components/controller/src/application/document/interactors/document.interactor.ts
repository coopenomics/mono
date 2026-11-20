import { Injectable, Inject } from '@nestjs/common';
import { DocumentsView } from '~/domain/document/enums/documents-view.enum';
import { SignedDocumentRole } from '~/domain/document/enums/signed-document-role.enum';
import { documentTitle } from '~/domain/document/services/document-title';
import type { GenerateDocumentDomainInterfaceWithOptions } from '~/domain/document/interfaces/generate-document-domain-with-options.interface';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import type { GetDocumentsInputDomainInterface } from '~/domain/document/interfaces/get-documents-input-domain.interface';
import { DocumentPackageAggregator } from '~/domain/document/aggregators/document-package.aggregator';
import { packageVisibleTo } from '~/domain/document/services/document-package-visibility';
import { DocumentAggregator } from '~/domain/document/aggregators/document.aggregator';
import type { DocumentAggregateDomainInterface } from '~/domain/document/interfaces/document-domain-aggregate.interface';
import type { ISignedDocument } from '@coopenomics/innercoop';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import config from '~/config/config';

@Injectable()
export class DocumentInteractor {
  constructor(
    @Inject(DocumentDomainService) private readonly documentDomainService: DocumentDomainService,
    @Inject(DocumentPackageAggregator)
    private readonly documentPackageAggregator: DocumentPackageAggregator,
    @Inject(DocumentAggregator) private readonly documentAggregator: DocumentAggregator,
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly signedDocumentRepository: SignedDocumentRepository
  ) {}

  public async generateDocument(data: GenerateDocumentDomainInterfaceWithOptions): Promise<DocumentDomainEntity> {
    return await this.documentDomainService.generateDocument(data);
  }

  public async getDocumentsAggregate(
    data: GetDocumentsInputDomainInterface
  ): Promise<PaginationResultDomainInterface<DocumentPackageAggregateDomainInterface>> {
    const { type, page = 1, limit = 100, query = {}, after_block, before_block, actions } = data;
    // Плоский вид — каждый документ журнала; пакетный — строки заявлений.
    const roles =
      data.view === DocumentsView.FLAT
        ? Object.values(SignedDocumentRole)
        : [SignedDocumentRole.Statement];

    // Read-path из PG-реестра подписанных документов (C28-21): отдаём ГОТОВЫЙ агрегат,
    // собранный на этапе ingestion/backfill — без обращений к explorer/Mongo и без сборки на лету.
    const username = this.extractReceiverScope(query);
    const result = await this.signedDocumentRepository.findAggregates({
      coopname: config.coopname,
      status: this.mapTypeToStatus(type),
      actions: actions && actions.length > 0 ? (actions as unknown as string[]) : undefined,
      username,
      hash: this.extractHashFilter(query),
      package: this.extractPackageFilter(query),
      afterBlock: after_block,
      beforeBlock: before_block,
      roles,
      signedFrom: data.signed_from,
      signedTo: data.signed_to,
      registryIds: data.registry_ids,
      query: data.search,
      page,
      limit,
    });

    // Пайщику — только полагающиеся ему документы пакета; совет (охват всего
    // кооператива, `username` не задан) видит пакет целиком.
    const visible = username
      ? result.items.map((item, index) => packageVisibleTo(item, result.owners[index] ?? '', username))
      : result.items;
    const items = visible.map((item, index) => {
      const row = result.rows[index];
      return {
        ...item,
        registry_hash: result.hashes?.[index] ?? null,
        title: documentTitle(row?.registry_id, row?.full_title),
        signed_at: row?.signed_at ?? null,
        role: row?.role ?? null,
      };
    });

    return {
      items,
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

  // Фильтр по пакету документов (хэшу процесса): страницы, которые идут от операции
  // учёта к её документам, знают хэш процесса, а не хэш документа. Охват пайщика
  // (`receiver`) ставит сервис поверх фильтра, чужой пакет так не открыть.
  private extractPackageFilter(query: Record<string, unknown>): string | undefined {
    const pkg = query['package'];
    return typeof pkg === 'string' && pkg.length > 0 ? pkg : undefined;
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
    signedDocument: ISignedDocument | null | undefined
  ): Promise<DocumentAggregateDomainInterface | null> {
    if (!signedDocument) return null;

    return await this.documentAggregator.buildDocumentAggregate(signedDocument);
  }

}
