// infrastructure/redis/redis.service.ts

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PROVIDER } from './redis.provider';
import { WinstonLoggerService } from '~/modules/logger/logger-app.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(REDIS_PROVIDER) private readonly redisClient: { subscriber: Redis; publisher: Redis },
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(RedisService.name);
  }

  async onModuleInit() {
    this.checkConnectionStatus();
  }

  onModuleDestroy() {
    this.redisClient.subscriber.quit();
    this.redisClient.publisher.quit();
  }

  async publish(channel: string, message: any): Promise<void> {
    if (this.redisClient.publisher.status !== 'ready') {
      this.logger.error('Publisher Redis client is not ready');
      return;
    }
    await this.redisClient.publisher.publish(channel, JSON.stringify(message));
  }

  subscribe(channel: string, handler: (message: any) => void) {
    if (this.redisClient.subscriber.status !== 'ready') {
      this.logger.error('Subscriber Redis client is not ready');
      return;
    }
    this.redisClient.subscriber.subscribe(channel);
    this.redisClient.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        handler(JSON.parse(message));
      }
    });
  }

  private checkConnectionStatus() {
    this.logger.log(`Subscriber status: ${this.redisClient.subscriber.status}`);
    this.logger.log(`Publisher status: ${this.redisClient.publisher.status}`);
  }
}
