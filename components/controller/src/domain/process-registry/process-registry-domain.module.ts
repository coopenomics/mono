import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeltaEntity } from '~/infrastructure/database/typeorm/entities/delta.entity';
import { ActionEntity } from '~/infrastructure/database/typeorm/entities/action.entity';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { ProcessRegistryService } from './services/process-registry.service';

/**
 * Доменный модуль ProcessRegistry.
 * Сервис getProcess/listProcesses — read-only агрегатор по _ledger2/wjournal+journal
 * и сущностным таблицам по PROCESS_HASH_LOCATOR. См. architecture.md §4.6.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeltaEntity, ActionEntity]),
    forwardRef(() => DocumentDomainModule),
    RedisModule,
  ],
  providers: [ProcessRegistryService],
  exports: [ProcessRegistryService],
})
export class ProcessRegistryDomainModule {}
