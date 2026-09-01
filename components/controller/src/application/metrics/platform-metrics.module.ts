import { Global, Module } from '@nestjs/common';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { PLATFORM_METRICS_PORT } from '~/domain/metrics/ports/platform-metrics.port';
import { USER_ACTIVITY_PORT } from '~/domain/metrics/ports/user-activity.port';
import { TypeOrmPlatformMetricsRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-platform-metrics.repository';
import { RedisUserActivityStore } from '~/infrastructure/redis/redis-user-activity.store';
import { PlatformMetricsService } from './platform-metrics.service';

/**
 * Прикладные метрики кооператива на GET /metrics.
 *
 * Модуль объявлен глобальным намеренно: его потребители — точка проверки JWT и
 * тик состояния узла, то есть места, которые не имеют к метрикам никакого
 * отношения и не должны ради одной строки телеметрии тянуть импорт модуля.
 * Так же в кодовой базе живёт `ParserDomainModule`.
 *
 * RedisModule импортируется явно: он не глобальный, а хранилищу активности
 * нужен REDIS_PROVIDER. DataSource приходит от `TypeOrmModule.forRoot` и
 * доступен приложению целиком.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [
    PlatformMetricsService,
    { provide: PLATFORM_METRICS_PORT, useClass: TypeOrmPlatformMetricsRepository },
    { provide: USER_ACTIVITY_PORT, useClass: RedisUserActivityStore },
  ],
  exports: [PlatformMetricsService, USER_ACTIVITY_PORT],
})
export class PlatformMetricsModule {}
