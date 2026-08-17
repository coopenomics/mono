import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecisionTrackingAdapter } from './adapters/decision-tracking.adapter';
import { TrackingRuleRepository } from './repositories/tracking-rule.repository';
import { TrackingRuleTypeormRepository } from './repositories/tracking-rule.typeorm-repository';
import { TrackingRuleEntity } from './entities/tracking-rule.entity';
import { SystemInfrastructureModule } from '~/infrastructure/system/system-infrastructure.module';

/**
 * Модуль инфраструктуры для отслеживания решений
 *
 * Примечание: TrackingRuleEntity регистрируется в общем TypeOrmModule (дефолтное подключение)
 * и переиспользуется здесь через forFeature для работы репозитория
 */
@Module({
  imports: [SystemInfrastructureModule, TypeOrmModule.forFeature([TrackingRuleEntity])],
  providers: [
    TrackingRuleTypeormRepository,
    {
      provide: TrackingRuleRepository,
      useClass: TrackingRuleTypeormRepository,
    },
    DecisionTrackingAdapter,
  ],
  // Токен `DECISION_TRACKING_PORT` привязан в `InnercoopBridgeModule` вместе с
  // остальными портами: одно место, где известны обе стороны.
  exports: [DecisionTrackingAdapter],
})
export class DecisionTrackingInfrastructureModule {}
