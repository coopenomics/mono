// infrastructure/redis/redis.service.ts

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PROVIDER } from './redis.provider';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { RedisPort } from '~/domain/common/ports/redis.port';

@Injectable()
export class RedisService implements OnModuleDestroy, RedisPort {
  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redisClient: { subscriber: Redis; publisher: Redis; streamManager: Redis; streamReader: Redis },
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(RedisService.name);
  }

  onModuleDestroy() {
    this.redisClient.subscriber.quit();
    this.redisClient.publisher.quit();
    this.redisClient.streamManager.quit();
    this.redisClient.streamReader.quit();
  }

  async publish(channel: string, message: any): Promise<void> {
    if (this.redisClient.publisher.status !== 'ready') {
      this.logger.error('Клиент Publisher Redis не готов');
      return;
    }
    await this.redisClient.publisher.publish(channel, JSON.stringify(message));
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (this.redisClient.streamManager.status !== 'ready') {
      this.logger.error('Клиент StreamManager Redis не готов');
      return null;
    }
    const value = await this.redisClient.streamManager.hgetall(key);
    return value && Object.keys(value).length > 0 ? value : null;
  }

  subscribe(channel: string, handler: (message: any) => void) {
    if (this.redisClient.subscriber.status !== 'ready') {
      this.logger.error('Клиент Subscriber Redis не готов');
      return;
    }
    this.redisClient.subscriber.subscribe(channel);
    this.redisClient.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        handler(JSON.parse(message));
      }
    });
  }
}
