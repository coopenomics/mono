import { Injectable, Inject } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '../repository/document.repository';
import { DocumentAggregator } from './document.aggregator';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import { Cooperative } from 'cooptypes';
import type { DocumentPackageAggregateDomainInterface } from '../interfaces/document-package-aggregate-domain.interface';
import { DocumentPackageV0Aggregator } from './document-package-v0.aggregator';
import { DocumentPackageV1Aggregator } from './document-package-v1.aggregator';
import { DocumentPackageUtils } from './document-package-utils.aggregator';

@Injectable()
export class DocumentPackageAggregator {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documentRepository: DocumentRepository,
    @Inject(DocumentAggregator) private readonly documentAggregator: DocumentAggregator,
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
    @Inject(DocumentPackageV0Aggregator)
    private readonly documentPackageV0Aggregator: DocumentPackageV0Aggregator,
    @Inject(DocumentPackageV1Aggregator)
    private readonly documentPackageV1Aggregator: DocumentPackageV1Aggregator,
    @Inject(DocumentPackageUtils) private readonly documentPackageUtils: DocumentPackageUtils
  ) {}

  /**
   * Создает агрегат пакета документов из блокчейн-действия
   * Определяет версию документа и делегирует обработку соответствующему агрегатору
   * @param rawAction Блокчейн-действие
   * @returns Агрегат пакета документов
   */
  async buildDocumentPackageAggregate(
    rawAction: Cooperative.Blockchain.IAction
  ): Promise<DocumentPackageAggregateDomainInterface> {
    // Определяем версию документа
    const docVersion = this.determineDocumentVersion(rawAction);

    // В зависимости от версии, вызываем соответствующую функцию обработки
    if (docVersion === '0') {
      // Старый формат
      return this.documentPackageV0Aggregator.buildDocumentPackageAggregateV0(rawAction);
    } else {
      // Новый формат
      return this.documentPackageV1Aggregator.buildDocumentPackageAggregateV1(rawAction);
    }
  }

  /**
   * Определяет версию документа в блокчейн-действии
   * @param rawAction Блокчейн-действие
   * @returns Версия документа в виде строки
   */
  private determineDocumentVersion(rawAction: Cooperative.Blockchain.IAction): string {
    return rawAction.data &&
      'document' in rawAction.data &&
      typeof rawAction.data.document === 'object' &&
      'version' in rawAction.data.document
      ? String((rawAction.data.document as { version?: string }).version)
      : '0';
  }
}
