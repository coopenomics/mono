import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PROVIDER } from './redis.provider';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

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
    @Inject(REDIS_PROVIDER)
    private readonly redisClient: { subscriber: Redis; publisher: Redis; streamManager: Redis; streamReader: Redis },
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(RedisStreamService.name);
  }

  onModuleDestroy() {
    // Останавливаем всех потребителей
    this.consumers.forEach((_, key) => {
      this.consumers.set(key, false);
    });
    // Закрываем дополнительные соединения
    this.redisClient.streamManager.quit();
    this.redisClient.streamReader.quit();
  }

  /**
   * Создание группы потребителей
   */
  async createConsumerGroup(stream: string, group: string, startId = '0'): Promise<void> {
    try {
      await this.redisClient.streamManager.xgroup('CREATE', stream, group, startId, 'MKSTREAM');
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
        const result: any = await this.redisClient.streamReader.xreadgroup(
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
      await this.redisClient.streamManager.xack(stream, group, messageId);
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
      return await this.redisClient.streamManager.xpending(stream, group);
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
      return await this.redisClient.streamManager.xinfo('GROUPS', stream);
    } catch (error: any) {
      this.logger.error(`Error getting consumer groups: ${error.message}`);
      throw error;
    }
  }

  /**
   * Прочитать pending-сообщения конкретного consumer'а (uncacknowledged).
   * Используется при старте для восстановления работы после рестарта:
   * сообщения, которые были выданы этому consumer'у, но не подтверждены
   * (например, coopback упал между handleMessage и acknowledgeMessage),
   * должны быть перечитаны и допоставлены.
   *
   * XREADGROUP с ID '0' означает «все pending этого consumer'а»,
   * а не новые — этим отличается от обычного '>'.
   */
  async readOwnPending(stream: string, group: string, consumer: string, count = 100): Promise<StreamMessage[]> {
    const result: any = await this.redisClient.streamReader.xreadgroup(
      'GROUP',
      group,
      consumer,
      'COUNT',
      count.toString(),
      'STREAMS',
      stream,
      '0',
    );
    return this.parseStreamResult(result, stream);
  }

  /**
   * XAUTOCLAIM: переназначить себе pending-сообщения других consumer'ов,
   * idle которых превысил minIdleMs. Это защита от зомби-consumer'ов:
   * предыдущий рестарт coopback оставил consumer "consumer-abc123" со своими
   * pending; новый consumer "coopback-main" заберёт их через XAUTOCLAIM.
   *
   * Redis 6.2+. Возвращает [nextCursor, claimedEntries, deletedIds?].
   */
  async autoClaimStale(
    stream: string,
    group: string,
    consumer: string,
    minIdleMs: number,
    count = 100,
  ): Promise<StreamMessage[]> {
    const result: any = await this.redisClient.streamManager.xautoclaim(
      stream,
      group,
      consumer,
      minIdleMs.toString(),
      '0',
      'COUNT',
      count.toString(),
    );
    // Redis 7+: [cursor, entries, deletedIds]. Redis 6.2: [cursor, entries].
    if (!Array.isArray(result) || result.length < 2) return [];
    const entries = result[1] as any[];
    const messages: StreamMessage[] = [];
    for (const [messageId, messageData] of entries) {
      if (!Array.isArray(messageData)) continue; // deleted entry
      const fields: Record<string, string> = {};
      for (let i = 0; i < messageData.length; i += 2) {
        fields[messageData[i]] = messageData[i + 1];
      }
      messages.push({ messageId, fields });
    }
    return messages;
  }

  /**
   * XTRIM MINID: удалить из stream записи с ID меньше minId.
   * Используется controller'ом для освобождения памяти Redis от уже
   * consumed сообщений. minId должен быть ≤ first-pending-id, иначе
   * удалим ещё не обработанные сообщения — всё, что в pending, защищено
   * этим граничным условием.
   *
   * `~` (approximate trim) — Redis удаляет эффективно по блокам radix tree,
   * реально удалённых записей может быть чуть больше или чуть меньше minId.
   */
  async trimUpTo(stream: string, minId: string): Promise<number> {
    return (await this.redisClient.streamManager.xtrim(stream, 'MINID', '~', minId)) as number;
  }

  /**
   * Минимальный pending ID в consumer-group (или null, если pending пусто).
   * XPENDING summary form возвращает [count, minId, maxId, consumers].
   */
  async getFirstPendingId(stream: string, group: string): Promise<string | null> {
    const summary: any = await this.redisClient.streamManager.xpending(stream, group);
    if (!Array.isArray(summary) || !summary[0]) return null;
    const count = Number(summary[0]);
    if (count === 0) return null;
    return (summary[1] as string) || null;
  }

  /**
   * Последний ID в stream (или '0-0', если stream пуст).
   * Нужен для trim'а когда pending пусто и last-delivered-id бесполезен:
   * безопасно обрезать всё до нынешнего конца stream'а только если ВСЕ
   * сообщения consumed. Проверка pending.count=0 — гарантия этого.
   */
  async getStreamLastId(stream: string): Promise<string> {
    const info: any = await this.redisClient.streamManager.xinfo('STREAM', stream);
    if (!Array.isArray(info)) return '0-0';
    // XINFO STREAM возвращает массив [key, value, key, value, ...].
    for (let i = 0; i < info.length; i += 2) {
      if (info[i] === 'last-generated-id') return String(info[i + 1] || '0-0');
    }
    return '0-0';
  }

  private parseStreamResult(result: any, expectedStream: string): StreamMessage[] {
    if (!result || !Array.isArray(result) || result.length === 0) return [];
    const messages: StreamMessage[] = [];
    for (const [streamName, streamMessages] of result) {
      if (streamName !== expectedStream) continue;
      for (const [messageId, messageData] of streamMessages) {
        const fields: Record<string, string> = {};
        for (let i = 0; i < messageData.length; i += 2) {
          fields[messageData[i]] = messageData[i + 1];
        }
        messages.push({ messageId, fields });
      }
    }
    return messages;
  }
}
