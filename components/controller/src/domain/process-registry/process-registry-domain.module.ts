import { Module } from '@nestjs/common';
import { ProcessJournalKyselyRepository } from '~/infrastructure/database/kysely/repositories/process-journal.kysely-repository';
import { PROCESS_JOURNAL_PORT } from './ports/process-journal.port';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { ProcessRegistryService } from './services/process-registry.service';

/**
 * Доменный модуль ProcessRegistry.
 * Сервис getProcess/listProcesses — read-only агрегатор по blockchain_actions
 * (Phase A: ledger2::apply якорит process_hash → operation_code → process_type)
 * и blockchain_deltas (Phase B: entity-таблицы из PROCESS_HASH_LOCATOR).
 * См. architecture.md §4.6.
 */
@Module({
  imports: [
    DocumentDomainModule,
    RedisModule,
  ],
  providers: [ProcessRegistryService, { provide: PROCESS_JOURNAL_PORT, useClass: ProcessJournalKyselyRepository }],
  exports: [ProcessRegistryService],
})
export class ProcessRegistryDomainModule {}
