import { Module } from '@nestjs/common';
import { LedgerResolver } from './resolvers/ledger.resolver';
import { LedgerService } from './services/ledger.service';
import { LedgerEventService } from './services/ledger-event.service';
import { LedgerInteractor } from './interactors/ledger.interactor';
import { LedgerDomainModule } from '~/domain/ledger/ledger-domain.module';
import { CoreRightsModule } from '../rights/core-rights.module';

/**
 * Модуль приложения для ledger
 * Содержит GraphQL резолверы, сервисы, интеракторы и DTO для работы с планом счетов
 */
@Module({
  imports: [CoreRightsModule, LedgerDomainModule],
  providers: [LedgerResolver, LedgerService, LedgerEventService, LedgerInteractor],
  exports: [LedgerInteractor],
})
export class LedgerModule {}
