import { Module } from '@nestjs/common';
import { BranchService } from './services/branch.service';
import { BranchResolver } from './resolvers/branch.resolver';
import { BranchInteractor } from './use-cases/branch.interactor';
import { DocumentModule } from '~/application/document/document.module';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [CoreRightsModule, DocumentModule],
  controllers: [],
  providers: [BranchInteractor, BranchService, BranchResolver],
  exports: [],
})
export class BranchModule {}
