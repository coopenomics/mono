// infrastructure/redis/redis.module.ts

import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisStreamService } from './redis-stream.service';
import { RedisProvider } from './redis.provider';

@Module({
  providers: [RedisProvider, RedisService, RedisStreamService],
  exports: [RedisService, RedisStreamService], // Экспортируем оба сервиса
})
export class RedisModule {}
