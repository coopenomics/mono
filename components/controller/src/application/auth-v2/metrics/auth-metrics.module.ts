import { Module } from '@nestjs/common';
import { AuthMetricsService } from './auth-metrics.service';

/**
 * Auth-метрики контура CoopID (Story 9.11). Эндпоинт `/metrics` и процессные
 * метрики поднимает корневой `PrometheusModule.register` в `app.module`; здесь —
 * только доменные счётчики входа, экспортируемые потребителям (этап-2 verify,
 * в перспективе legacy-контур для alert Story 7.12).
 */
@Module({
  providers: [AuthMetricsService],
  exports: [AuthMetricsService],
})
export class AuthMetricsModule {}
