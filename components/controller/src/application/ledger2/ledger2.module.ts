import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeltaEntity } from '~/infrastructure/database/typeorm/entities/delta.entity';
import { ActionEntity } from '~/infrastructure/database/typeorm/entities/action.entity';
import { LEDGER2_STATE_PORT } from '~/domain/ledger2/ports/ledger2-state.port';
import { TypeOrmLedger2StateRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-ledger2-state.repository';
import { Ledger2Service } from './services/ledger2.service';
import { Ledger2Resolver } from './resolvers/ledger2.resolver';
import { Ledger2InterHistoryAdapter } from './infrastructure/inter/ledger2-inter-history.adapter';

/**
 * Модуль ledger2 — read-only фасад над blockchain_deltas/blockchain_actions.
 * Подключается в корневой AppModule. `Ledger2InterHistoryAdapter` — реализация
 * `InterLedger2HistoryPort` (@coopenomics/inter), которую биндит на токен
 * `InterCommunicationBridgeModule`; экспортирован здесь, чтобы тот мог сделать
 * `useExisting` без прямого импорта consumer-extension'ами `Ledger2Service`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DeltaEntity, ActionEntity])],
  providers: [
    Ledger2Service,
    Ledger2Resolver,
    Ledger2InterHistoryAdapter,
    {
      provide: LEDGER2_STATE_PORT,
      useClass: TypeOrmLedger2StateRepository,
    },
  ],
  exports: [Ledger2Service, LEDGER2_STATE_PORT, Ledger2InterHistoryAdapter],
})
export class Ledger2Module {}
