import { Module } from '@nestjs/common';
import { DocumentModule } from '../document/document.module';
import { FreeDecisionResolver } from './resolvers/free-decision.resolver';
import { FreeDecisionService } from './services/free-decision.service';
import { FreeDecisionDomainModule } from '~/domain/free-decision/free-decision.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { GeneratorInfrastructureModule } from '~/infrastructure/generator/generator.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { FreeDecisionInteractor } from './interactors/free-decision.interactor';
import { AgendaModule } from '../agenda/agenda.module';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [
    CoreRightsModule,
    DocumentModule,
    FreeDecisionDomainModule,
    DocumentDomainModule,
    GeneratorInfrastructureModule,
    UserDomainModule,
    AgendaModule,
  ],
  controllers: [],
  providers: [FreeDecisionResolver, FreeDecisionService, FreeDecisionInteractor],
  exports: [FreeDecisionInteractor],
})
export class DecisionModule {}
