import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeltaEntity } from '~/infrastructure/database/typeorm/entities/delta.entity';
import { ActionEntity } from '~/infrastructure/database/typeorm/entities/action.entity';
import { LEDGER2_STATE_PORT } from '~/domain/ledger2/ports/ledger2-state.port';
import { TypeOrmLedger2StateRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-ledger2-state.repository';
import { Ledger2Service } from './services/ledger2.service';
import { Ledger2Resolver } from './resolvers/ledger2.resolver';

/**
 * Модуль ledger2 — read-only фасад над blockchain_deltas/blockchain_actions.
 * Подключается в корневой AppModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DeltaEntity, ActionEntity])],
  providers: [
    Ledger2Service,
    Ledger2Resolver,
    {
      provide: LEDGER2_STATE_PORT,
      useClass: TypeOrmLedger2StateRepository,
    },
  ],
  exports: [Ledger2Service, LEDGER2_STATE_PORT],
})
export class Ledger2Module {}
