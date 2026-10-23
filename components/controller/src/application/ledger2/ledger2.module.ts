import { Module } from '@nestjs/common';
import { LEDGER2_STATE_PORT } from '~/domain/ledger2/ports/ledger2-state.port';
import { Ledger2StateKyselyRepository } from '~/infrastructure/database/kysely/repositories/ledger2-state.kysely-repository';
import { Ledger2Service } from './services/ledger2.service';
import { Ledger2Resolver } from './resolvers/ledger2.resolver';
import { Ledger2InnercoopHistoryAdapter } from './infrastructure/innercoop/ledger2-innercoop-history.adapter';
import { CoreRightsModule } from '../rights/core-rights.module';

/**
 * Модуль ledger2 — read-only фасад над blockchain_deltas/blockchain_actions.
 * Подключается в корневой AppModule. `Ledger2InnercoopHistoryAdapter` — реализация
 * `ILedger2HistoryPort` (@coopenomics/innercoop), которую биндит на токен
 * `InnercoopBridgeModule`; экспортирован здесь, чтобы тот мог сделать
 * `useExisting` без прямого импорта consumer-extension'ами `Ledger2Service`.
 */
@Module({
  imports: [CoreRightsModule],
  providers: [
    Ledger2Service,
    Ledger2Resolver,
    Ledger2InnercoopHistoryAdapter,
    {
      provide: LEDGER2_STATE_PORT,
      useClass: Ledger2StateKyselyRepository,
    },
  ],
  exports: [Ledger2Service, LEDGER2_STATE_PORT, Ledger2InnercoopHistoryAdapter],
})
export class Ledger2Module {}
