import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationOutboxTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-outbox.typeorm-entity';
import { NotificationDeliveryTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-delivery.typeorm-entity';
import {
  NotificationDeliveryStatus,
  NotificationOutboxStatus,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import {
  EMAIL_CHANNEL_PORT,
  IN_APP_CHANNEL_PORT,
  WEB_PUSH_CHANNEL_PORT,
  type ChannelDeliveryResult,
  type ChannelMessage,
  type EmailChannelPort,
  type InAppChannelPort,
  type WebPushChannelPort,
} from '~/domain/notification/interfaces/channel.ports';

// Параметры worker'а — ENV-sourced с дефолтами (канон: не hardcode magic numbers).
// Тик опроса очереди; при пустой таблице — один индексный запрос, CPU idle (NFR2).
const WORKER_INTERVAL_MS = Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS) || 3000;
// Сколько строк забирать за тик (защита от длинного тика на большом всплеске).
const WORKER_BATCH_SIZE = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE) || 50;
// SENDING дольше этого порога считаем «зависшим» (крах между claim и отправкой) и реклеймим.
const SENDING_STALE_MS = Number(process.env.NOTIFICATION_WORKER_SENDING_STALE_MS) || 120_000;
// Экспоненциальный backoff по номеру попытки. Последнее значение — для попыток сверх длины.
const BACKOFF_SCHEDULE_MS = [5_000, 30_000, 120_000, 600_000, 3_600_000];

/** Канал доставки — общая форма всех channel-портов (структурно совпадают). */
type DeliveryChannelPort = { send(message: ChannelMessage): Promise<ChannelDeliveryResult> };

/**
 * Outbox-worker Центра уведомлений (эпик 3).
 *
 * Фоновый поллер `notification_outbox`: забирает готовые строки по индексу
 * `(status, scheduled_at)`, шлёт через порт нужного канала, исход пишет в журнал
 * `notification_deliveries`. Принцип at-least-once: при временном сбое — ретрай
 * с экспоненциальным backoff; после `maxAttempts` строка → терминальный `failed`
 * (переотправляема со стола председателя, эпик 6). Дубликаты гасит идемпотентность
 * из эпика 1.
 *
 * Строка outbox = один канал (роутер бьёт fan-out по каналам), поэтому попытки по
 * каналам ретраятся независимо: лежит SMTP — push/in-app уже доставлены, у каждого
 * своя строка со своим status/attempts/scheduledAt.
 */
@Injectable()
export class OutboxWorkerService implements OnModuleInit {
  private readonly logger = new Logger(OutboxWorkerService.name);
  // Гард от наложения тиков (single-instance): длинный тик не запускается повторно.
  private isRunning = false;
  private readonly channelPorts: Partial<Record<NotificationChannel, DeliveryChannelPort>>;

  constructor(
    @InjectRepository(NotificationOutboxTypeormEntity)
    private readonly outboxRepository: Repository<NotificationOutboxTypeormEntity>,
    @InjectRepository(NotificationDeliveryTypeormEntity)
    private readonly deliveryRepository: Repository<NotificationDeliveryTypeormEntity>,
    @Inject(EMAIL_CHANNEL_PORT) emailChannel: EmailChannelPort,
    @Inject(IN_APP_CHANNEL_PORT) inAppChannel: InAppChannelPort,
    @Inject(WEB_PUSH_CHANNEL_PORT) webPushChannel: WebPushChannelPort
  ) {
    this.channelPorts = {
      [NotificationChannel.EMAIL]: emailChannel,
      [NotificationChannel.IN_APP]: inAppChannel,
      [NotificationChannel.PUSH]: webPushChannel,
    };
  }

  onModuleInit(): void {
    // Признак, что worker поднялся (иначе при пустой очереди в логах ничего нет).
    this.logger.log(
      `Outbox-worker Центра уведомлений запущен: интервал ${WORKER_INTERVAL_MS} мс, батч ${WORKER_BATCH_SIZE}`
    );
  }

  @Interval('notification-outbox-worker', WORKER_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.processBatch();
    } catch (error: any) {
      // Никогда не глушим тихо: ошибка тика логируется, очередь подберётся следующим тиком.
      this.logger.error(`Ошибка тика outbox-worker'а: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  private async processBatch(): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - SENDING_STALE_MS);

    // PENDING со scheduledAt ≤ now ИЛИ зависший SENDING (реклейм после краха/рестарта).
    const candidates = await this.outboxRepository
      .createQueryBuilder('o')
      .where('o.status = :pending AND o.scheduledAt <= :now', {
        pending: NotificationOutboxStatus.PENDING,
        now,
      })
      .orWhere('o.status = :sending AND o.updatedAt <= :staleBefore', {
        sending: NotificationOutboxStatus.SENDING,
        staleBefore,
      })
      .orderBy('o.scheduledAt', 'ASC')
      .take(WORKER_BATCH_SIZE)
      .getMany();

    if (candidates.length === 0) return;

    // Виден только в debug-уровне — heartbeat обработки, не шумит на проде.
    this.logger.debug(`Тик: к обработке ${candidates.length} строк очереди`);

    for (const row of candidates) {
      await this.processRow(row, now);
    }
  }

  private async processRow(row: NotificationOutboxTypeormEntity, now: Date): Promise<void> {
    // Claim: PENDING/stale-SENDING → SENDING, счётчик попыток +1.
    row.status = NotificationOutboxStatus.SENDING;
    row.attempts += 1;
    await this.outboxRepository.save(row);
    const attemptNumber = row.attempts;

    const port = this.channelPorts[row.channel];
    const result: ChannelDeliveryResult = port
      ? await this.safeSend(port, row)
      : { delivered: false, error: `нет адаптера для канала '${row.channel}'` };

    // Контекст для логов — председатель/оператор должен видеть, кому что и почему.
    const ctx = `workflow=${row.workflowId} канал=${row.channel} получатель=${row.recipientUsername || row.recipientSubscriberId} попытка ${attemptNumber}/${row.maxAttempts}`;

    // Канал неприменим к получателю (нет push-подписки / нет email-адреса) — это
    // не сбой доставки: гасим строку в canceled, без ретраев и без записи попытки
    // в журнал. Причину кладём в lastError (тултип «Отменено» на столе председателя).
    if (result.skipped) {
      row.status = NotificationOutboxStatus.CANCELED;
      row.lastError = result.error;
      await this.outboxRepository.save(row);
      // info-уровень: председатель/оператор должен видеть, что и почему не ушло.
      this.logger.log(`Канал пропущен (неприменим к получателю): ${ctx}: ${result.error}`);
      return;
    }

    // Журнал попытки (append-only) — источник стола председателя.
    await this.deliveryRepository.save(
      this.deliveryRepository.create({
        outboxId: row.id,
        coopname: row.coopname,
        channel: row.channel,
        recipientSubscriberId: row.recipientSubscriberId,
        workflowId: row.workflowId,
        attemptNumber,
        status: result.delivered ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
        providerResponse: result.providerResponse,
        error: result.error,
      })
    );

    if (result.delivered) {
      row.status = NotificationOutboxStatus.SENT;
      row.lastError = undefined;
      // info-уровень: каждая успешная доставка видна в логах без рытья в БД.
      this.logger.log(`Доставлено: ${ctx}${result.providerResponse ? ` (${result.providerResponse})` : ''}`);
    } else if (row.attempts >= row.maxAttempts) {
      // Попытки исчерпаны — терминальный failed (виден/переотправляем на столе председателя).
      row.status = NotificationOutboxStatus.FAILED;
      row.lastError = result.error;
      this.logger.error(`Доставка провалена окончательно: ${ctx}: ${result.error}`);
    } else {
      // Временный сбой — назад в PENDING с backoff-паузой.
      row.status = NotificationOutboxStatus.PENDING;
      row.lastError = result.error;
      row.scheduledAt = new Date(now.getTime() + this.backoffMs(row.attempts));
      this.logger.warn(`Доставка не удалась, будет ретрай: ${ctx}: ${result.error}`);
    }
    await this.outboxRepository.save(row);
  }

  /** Изоляция исключения адаптера: бросок канала = провал попытки, не падение тика. */
  private async safeSend(
    port: DeliveryChannelPort,
    row: NotificationOutboxTypeormEntity
  ): Promise<ChannelDeliveryResult> {
    try {
      return await port.send(this.buildMessage(row));
    } catch (error: any) {
      return { delivered: false, error: error.message };
    }
  }

  private buildMessage(row: NotificationOutboxTypeormEntity): ChannelMessage {
    return {
      outboxId: row.id,
      coopname: row.coopname,
      workflowId: row.workflowId,
      recipient: {
        subscriberId: row.recipientSubscriberId,
        email: row.recipientEmail,
        username: row.recipientUsername,
      },
      payload: row.payload,
      actorSubscriberId: row.actorSubscriberId,
    };
  }

  private backoffMs(attempts: number): number {
    return BACKOFF_SCHEDULE_MS[Math.min(attempts - 1, BACKOFF_SCHEDULE_MS.length - 1)];
  }
}
