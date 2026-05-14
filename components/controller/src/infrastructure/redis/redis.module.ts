// infrastructure/redis/redis.module.ts

import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisStreamService } from './redis-stream.service';
import { RedisProvider, REDIS_PROVIDER } from './redis.provider';
import { REDIS_PORT } from '~/domain/common/ports/redis.port';

@Module({
  providers: [
    RedisProvider,
    RedisService,
    RedisStreamService,
    {
      provide: REDIS_PORT,
      useClass: RedisService,
    },
  ],
  exports: [RedisService, RedisStreamService, REDIS_PORT, REDIS_PROVIDER],
})
export class RedisModule {}
