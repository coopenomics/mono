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
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';

// Параметры worker'а — ENV-sourced с дефолтами (канон: не hardcode magic numbers).
// Тик опроса очереди; при пустой таблице — один индексный запрос, CPU idle (NFR2).
const WORKER_INTERVAL_MS = Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS) || 3000;
// Сколько строк забирать за тик (защита от длинного тика на большом всплеске).
const WORKER_BATCH_SIZE = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE) || 50;
// SENDING дольше этого порога считаем «зависшим» (крах между claim и отправкой) и реклеймим.
const SENDING_STALE_MS = Number(process.env.NOTIFICATION_WORKER_SENDING_STALE_MS) || 120_000;
// Экспоненциальный backoff по номеру попытки. Последнее значение — для попыток сверх длины.
const BACKOFF_SCHEDULE_MS = [5_000, 30_000, 120_000, 600_000, 3_600_000];
// Сколько всего ждём восстановления лежащего канала, считая от постановки в очередь.
// Сутки: переживает ночное падение узла, но не копит письма бесконечно.
const DELIVERY_WINDOW_MS = Number(process.env.NOTIFICATION_DELIVERY_WINDOW_MS) || 24 * 60 * 60 * 1000;
// Пауза между попытками, пока канал лежит. Своё расписание, короче общего:
// когда канал вернётся, письмо должно уйти в пределах десяти минут, а не часа.
const TRANSPORT_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000];

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
 * Из счёта `maxAttempts` изъят один случай — **канал лежит целиком**
 * (`transportUnavailable`, см. {@link ChannelDeliveryResult}). Пять попыток
 * выгорают за 17 минут, а инфраструктура падает на часы: 08.09.2026 почтовый
 * шлюз `provider-1` был недоступен с 08:47 до 10:34, и четыре кода подтверждения
 * умерли окончательно — вернувшийся канал их уже не досылал, человек об этом не
 * знал и перебирал свои почтовые ящики. Теперь такие строки ждут возвращения
 * канала в пределах окна `NOTIFICATION_DELIVERY_WINDOW_MS` (сутки) и уходят
 * сами, как только он ответит.
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
    const target = `workflow=${row.workflowId} канал=${row.channel} получатель=${row.recipientUsername || row.recipientSubscriberId}`;
    const ctx = `${target} попытка ${attemptNumber}/${row.maxAttempts}`;
    // Ожидание канала номера попытки не имеет — писать «попытка 5/5» там,
    // где лимит не тратится, значит врать читателю логов.
    const waitCtx = target;

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

    // Канал лежит целиком — письмо ни при чём. Такая попытка НЕ тратит лимит:
    // откатываем инкремент claim'а и ждём возвращения канала до конца окна
    // доставки, уходя сразу, как он оживёт.
    const transportDown = !result.delivered && result.transportUnavailable === true;
    const waitedMs = now.getTime() - new Date(row.createdAt).getTime();
    const windowLeft = DELIVERY_WINDOW_MS - waitedMs;

    if (transportDown && windowLeft > 0) {
      await this.parkUntilChannelReturns(row, result, now, waitedMs, windowLeft, waitCtx);
      return;
    }

    await this.recordOutcome(row, result, { attemptNumber, ctx, now, transportDown });
  }

  /**
   * Отложить письмо до возвращения канала: откатить потраченную попытку и
   * назначить следующий заход. В журнал доставок такой заход не пишем — журнал
   * отвечает на вопрос «сколько раз пытались доставить адресату», а не «сколько
   * раз лежал канал»: сутки простоя забили бы его сотней пустых строк на письмо.
   */
  private async parkUntilChannelReturns(
    row: NotificationOutboxTypeormEntity,
    result: ChannelDeliveryResult,
    now: Date,
    waitedMs: number,
    windowLeft: number,
    waitCtx: string
  ): Promise<void> {
    row.attempts = Math.max(0, row.attempts - 1);
    row.status = NotificationOutboxStatus.PENDING;
    row.lastError = result.error;
    row.scheduledAt = new Date(now.getTime() + transportBackoffMs(waitedMs));
    await this.outboxRepository.save(row);
    this.logger.warn(
      `Канал недоступен, письмо ждёт восстановления (лимит попыток не тратится, в запасе ${formatDuration(windowLeft)}): ${waitCtx}: ${result.error}`
    );
  }

  /** Записать исход состоявшейся попытки: журнал + терминальный статус либо ретрай. */
  private async recordOutcome(
    row: NotificationOutboxTypeormEntity,
    result: ChannelDeliveryResult,
    meta: { attemptNumber: number; ctx: string; now: Date; transportDown: boolean }
  ): Promise<void> {
    const { attemptNumber, ctx, now, transportDown } = meta;

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
    } else if (transportDown) {
      // Окно вышло: канала не было целые сутки — дальше держать письмо смысла нет.
      row.status = NotificationOutboxStatus.FAILED;
      row.lastError = result.error;
      this.logger.error(
        `Доставка провалена: канал не вернулся за ${formatDuration(DELIVERY_WINDOW_MS)}: ${ctx}: ${result.error}`
      );
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

/**
 * Пауза до следующего стука в лежащий канал. Считается от того, сколько письмо
 * уже ждёт, а не от счётчика попыток: счётчик мы при недоступности канала не
 * увеличиваем, а лишнего состояния в строке заводить не нужно. Первые минуты
 * пробуем часто (короткий сбой — письмо уходит почти сразу), дальше реже, но
 * не реже десяти минут, чтобы после возвращения канала не держать очередь.
 */
export function transportBackoffMs(waitedMs: number): number {
  const step = [2 * 60_000, 10 * 60_000, 30 * 60_000, 2 * 60 * 60_000].findIndex((limit) => waitedMs < limit);
  return TRANSPORT_BACKOFF_MS[step === -1 ? TRANSPORT_BACKOFF_MS.length - 1 : step];
}

/** «1 ч 30 мин» / «45 мин» / «30 с» — для человекочитаемых строк лога. */
function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return `${Math.round(ms / 1000)} с`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} мин`;
  return minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`;
}
