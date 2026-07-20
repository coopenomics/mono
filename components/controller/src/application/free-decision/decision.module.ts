import { Module, forwardRef } from '@nestjs/common';
import { DocumentModule } from '../document/document.module';
import { FreeDecisionResolver } from './resolvers/free-decision.resolver';
import { FreeDecisionService } from './services/free-decision.service';
import { FreeDecisionDomainModule } from '~/domain/free-decision/free-decision.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { GeneratorInfrastructureModule } from '~/infrastructure/generator/generator.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { FreeDecisionInteractor } from './interactors/free-decision.interactor';
import { AgendaModule } from '../agenda/agenda.module';

@Module({
  imports: [
    DocumentModule,
    FreeDecisionDomainModule,
    DocumentDomainModule,
    GeneratorInfrastructureModule,
    forwardRef(() => UserDomainModule),
    AgendaModule,
  ],
  controllers: [],
  providers: [FreeDecisionResolver, FreeDecisionService, FreeDecisionInteractor],
  exports: [FreeDecisionInteractor],
})
export class DecisionModule {}
