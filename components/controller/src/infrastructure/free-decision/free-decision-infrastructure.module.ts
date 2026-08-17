import { Module } from '@nestjs/common';
import { FreeDecisionAdapter } from './free-decision.adapter';
import { DecisionModule } from '~/application/free-decision/decision.module';

@Module({
  imports: [DecisionModule],
  providers: [FreeDecisionAdapter],
  // Токен `FREE_DECISION_PORT` привязан в `InnercoopBridgeModule` вместе с
  // остальными портами: одно место, где известны обе стороны.
  exports: [FreeDecisionAdapter],
})
export class FreeDecisionInfrastructureModule {}
