import { Module } from '@nestjs/common';
import { AgreementResolver } from './resolvers/agreement.resolver';
import { AgreementService } from './services/agreement.service';
import { AgreementInteractor } from './use-cases/agreement.interactor';
import { DocumentModule } from '~/application/document/document.module';
import { DocumentDomainModule } from '~/domain/document/document.module';

/**
 * Модуль соглашений.
 *
 * `AgreementService` объединяет два источника (Эпик 2): непрограммные
 * соглашения из `agreements3` и программные из `wallet::users.programs[]`.
 * Оба репозитория экспортируются глобальным `TypeOrmModule`.
 */
@Module({
  imports: [DocumentModule, DocumentDomainModule],
  controllers: [],
  providers: [AgreementResolver, AgreementService, AgreementInteractor],
  exports: [],
})
export class AgreementModule {}
