import { Module } from '@nestjs/common';
import { Ledger2Resolver } from './resolvers/ledger2.resolver';
import { Ledger2Service } from './services/ledger2.service';

/**
 * Модуль приложения для ledger2.
 * BlockchainService уже глобален (BlockchainModule @Global), отдельных доменных
 * портов пока не требуется — валидатор читает таблицу journal напрямую.
 */
@Module({
  imports: [],
  providers: [Ledger2Resolver, Ledger2Service],
  exports: [Ledger2Service],
})
export class Ledger2Module {}
