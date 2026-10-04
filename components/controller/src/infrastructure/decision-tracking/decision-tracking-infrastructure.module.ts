import { Module } from '@nestjs/common';
import { DecisionTrackingAdapter } from './adapters/decision-tracking.adapter';
import { TrackingRuleRepository } from './repositories/tracking-rule.repository';
import { TrackingRuleKyselyRepository } from './repositories/tracking-rule.kysely-repository';
import { SystemInfrastructureModule } from '~/infrastructure/system/system-infrastructure.module';

/**
 * Модуль инфраструктуры для отслеживания решений
 */
@Module({
  imports: [SystemInfrastructureModule],
  providers: [
    {
      provide: TrackingRuleRepository,
      useClass: TrackingRuleKyselyRepository,
    },
    DecisionTrackingAdapter,
  ],
  // Токен `DECISION_TRACKING_PORT` привязан в `InnercoopBridgeModule` вместе с
  // остальными портами: одно место, где известны обе стороны.
  exports: [DecisionTrackingAdapter],
})
export class DecisionTrackingInfrastructureModule {}
