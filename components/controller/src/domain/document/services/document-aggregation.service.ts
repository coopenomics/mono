import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { DocumentAggregator } from '../aggregators/document.aggregator';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
import type { DocumentDomainAggregate } from '../aggregates/document-domain.aggregate';

/**
 * Сервис для агрегации документов в доменном слое
 * Выделен в отдельный сервис для избежания дублирования кода
 * и соблюдения принципов чистой архитектуры
 */
@Injectable()
export class DocumentAggregationService {
  // Пустой хеш для проверки документов
  private readonly EMPTY_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(@Inject(forwardRef(() => DocumentAggregator)) private readonly documentAggregator: DocumentAggregator) {}

  /**
   * Создает агрегат документа из формата ISignedDocumentDomainInterface
   * @param signedDocument Подписанный документ
   * @returns Агрегат документа
   */
  async buildDocumentAggregate(signedDocument: ISignedDocumentDomainInterface): Promise<DocumentDomainAggregate | null> {
    if (!signedDocument) return null;

    // Проверяем, что хеш документа не пустой
    if (signedDocument.doc_hash === this.EMPTY_HASH) return null;

    // Используем существующий агрегатор для сборки агрегата
    return this.documentAggregator.buildDocumentAggregate(signedDocument);
  }
}
