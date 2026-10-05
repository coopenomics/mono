import { Module } from '@nestjs/common';
import { DocumentApprovalResolver } from './resolvers/document-approval.resolver';
import { CoreRightsModule } from '../rights/core-rights.module';

/**
 * Application-модуль фабрики утверждений документов: GraphQL-резолверы.
 * Сервисы доступны глобально из `DocumentApprovalDomainModule`.
 */
@Module({
  imports: [CoreRightsModule],
  providers: [DocumentApprovalResolver],
})
export class DocumentApprovalApplicationModule {}
