import { Module } from '@nestjs/common';
import { BlockchainExplorerResolver } from './resolvers/blockchain-explorer.resolver';
import { DeltaService } from './services/delta.service';
import { ActionService } from './services/action.service';
import { CurrentTableStatesService } from './services/current-table-states.service';
import { GetDeltasInteractor } from './interactors/get-deltas.interactor';
import { GetActionsInteractor } from './interactors/get-actions.interactor';
import { GetCurrentTableStatesInteractor } from './interactors/get-current-table-states.interactor';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [CoreRightsModule, ],
  providers: [
    BlockchainExplorerResolver,
    DeltaService,
    ActionService,
    CurrentTableStatesService,
    GetDeltasInteractor,
    GetActionsInteractor,
    GetCurrentTableStatesInteractor,
  ],
  exports: [DeltaService, ActionService, CurrentTableStatesService],
})
export class BlockchainExplorerModule {}
