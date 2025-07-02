import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PROVIDER } from './redis.provider';
import { WinstonLoggerService } from '~/modules/logger/logger-app.service';

export interface StreamMessage {
  messageId: string;
  fields: Record<string, string>;
}

export interface StreamConsumerOptions {
  stream: string;
  group: string;
  consumer: string;
  count?: number;
  block?: number;
}

/**
 * Сервис для работы с Redis Streams
 * Обеспечивает надежное потребление событий от parser
 */
@Injectable()
export class RedisStreamService implements OnModuleDestroy {
  private consumers: Map<string, boolean> = new Map();

  constructor(
    @Inject(REDIS_PROVIDER) private readonly redisClient: { subscriber: Redis; publisher: Redis },
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(RedisStreamService.name);
  }

  onModuleDestroy() {
    // Останавливаем всех потребителей
    this.consumers.forEach((_, key) => {
      this.consumers.set(key, false);
    });
  }

  /**
   * Создание группы потребителей
   */
  async createConsumerGroup(stream: string, group: string, startId = '0'): Promise<void> {
    try {
      await this.redisClient.subscriber.xgroup('CREATE', stream, group, startId, 'MKSTREAM');
      this.logger.log(`Consumer group created: ${group} for stream: ${stream}`);
    } catch (error: any) {
      if (error.message.includes('BUSYGROUP')) {
        this.logger.log(`Consumer group ${group} already exists for stream ${stream}`);
      } else {
        this.logger.error(`Error creating consumer group: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Потребление сообщений из stream
   */
  async startConsumer(
    options: StreamConsumerOptions,
    messageHandler: (message: StreamMessage) => Promise<void>
  ): Promise<void> {
    const { stream, group, consumer, count = 1, block = 1000 } = options;
    const consumerKey = `${stream}:${group}:${consumer}`;

    // Отмечаем потребителя как активного
    this.consumers.set(consumerKey, true);

    this.logger.log(`Starting consumer: ${consumerKey}`);

    while (this.consumers.get(consumerKey)) {
      try {
        const result: any = await this.redisClient.subscriber.xreadgroup(
          'GROUP',
          group,
          consumer,
          'COUNT',
          count.toString(),
          'BLOCK',
          block.toString(),
          'STREAMS',
          stream,
          '>'
        );

        if (result && result.length > 0) {
          for (const [streamName, messages] of result) {
            if (streamName === stream) {
              for (const [messageId, messageData] of messages) {
                const fields: Record<string, string> = {};

                // Преобразуем массив [key, value, key, value] в объект
                for (let i = 0; i < messageData.length; i += 2) {
                  fields[messageData[i]] = messageData[i + 1];
                }

                try {
                  await messageHandler({ messageId, fields });
                  await this.acknowledgeMessage(stream, group, messageId);
                } catch (error: any) {
                  this.logger.error(`Error processing message ${messageId}: ${error.message}`);
                  // Не подтверждаем сообщение при ошибке - оно останется в pending
                }
              }
            }
          }
        }
      } catch (error: any) {
        if (this.consumers.get(consumerKey)) {
          this.logger.error(`Consumer ${consumerKey} error: ${error.message}`);
          // Небольшая пауза перед повторной попыткой
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    this.logger.log(`Consumer stopped: ${consumerKey}`);
  }

  /**
   * Подтверждение обработки сообщения
   */
  async acknowledgeMessage(stream: string, group: string, messageId: string): Promise<void> {
    try {
      await this.redisClient.subscriber.xack(stream, group, messageId);
      this.logger.debug(`Message acknowledged: ${messageId} in stream ${stream}`);
    } catch (error: any) {
      this.logger.error(`Error acknowledging message ${messageId} in stream ${stream}, group ${group}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Остановка потребителя
   */
  stopConsumer(stream: string, group: string, consumer: string): void {
    const consumerKey = `${stream}:${group}:${consumer}`;
    this.consumers.set(consumerKey, false);
    this.logger.log(`Stopping consumer: ${consumerKey}`);
  }

  /**
   * Получение информации о pending сообщениях
   */
  async getPendingMessages(stream: string, group: string): Promise<any> {
    try {
      return await this.redisClient.subscriber.xpending(stream, group);
    } catch (error: any) {
      this.logger.error(`Error getting pending messages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение информации о группах потребителей
   */
  async getConsumerGroups(stream: string): Promise<any> {
    try {
      return await this.redisClient.subscriber.xinfo('GROUPS', stream);
    } catch (error: any) {
      this.logger.error(`Error getting consumer groups: ${error.message}`);
      throw error;
    }
  }
}
