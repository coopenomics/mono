import { Module } from '@nestjs/common';
import { DecisionResolver } from './resolvers/decision.resolver';
import { DecisionService } from './services/decision.service';
import { DecisionInteractor } from './use-cases/decision.interactor';

@Module({
  providers: [DecisionResolver, DecisionService, DecisionInteractor],
})
export class DecisionAuthorizeModule {}
