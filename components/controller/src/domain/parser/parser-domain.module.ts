import { Global, Module } from '@nestjs/common';
import { ParserInteractor } from './interactors/parser.interactor';
import { BlockchainEventHandlerService } from './services/blockchain-event-handler.service';
import { BlockchainActionHistoryService } from './services/blockchain-action-history.service';

/**
 * Доменный модуль парсера блокчейна
 * Содержит чистую бизнес-логику и доступ к инфраструктуре для репозиториев
 */
@Global()
@Module({
  imports: [],
  providers: [ParserInteractor, BlockchainEventHandlerService, BlockchainActionHistoryService],
  exports: [ParserInteractor, BlockchainEventHandlerService, BlockchainActionHistoryService],
})
export class ParserDomainModule {}
