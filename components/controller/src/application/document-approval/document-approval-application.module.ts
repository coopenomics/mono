import { Module } from '@nestjs/common';
import { DocumentApprovalResolver } from './resolvers/document-approval.resolver';

/**
 * Application-модуль фабрики утверждений документов: GraphQL-резолверы.
 * Сервисы доступны глобально из `DocumentApprovalDomainModule`.
 */
@Module({
  providers: [DocumentApprovalResolver],
})
export class DocumentApprovalApplicationModule {}
