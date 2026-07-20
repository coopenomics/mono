import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workflows } from '@coopenomics/notifications';
import type { EntityManager, Repository } from 'typeorm';
import { NotificationOutboxTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-outbox.typeorm-entity';
import { NotificationOutboxStatus } from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import {
  NotificationChannel,
  type NotifyInput,
  type NotifyRecipient,
  type NotifyResult,
} from '~/domain/notification/interfaces/notify-input.domain.interface';
import type { NotificationPort } from '~/domain/notification/interfaces/notify.port';

/** Каналы, активные в MVP. step.type каталога может нести и delay/digest/sms — игнорируем. */
const ACTIVE_CHANNELS: readonly NotificationChannel[] = [
  NotificationChannel.EMAIL,
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
];

/**
 * Роутер Центра уведомлений — реализация {@link NotificationPort}.
 *
 * Принимает `notify()`, по типу уведомления резолвит набор каналов из каталога
 * `@coopenomics/notifications` (`steps[].type`), и для каждой пары получатель×канал
 * пишет идемпотентную строку в `notification_outbox`. Сама не отправляет —
 * отправку подхватывает worker (эпик 3).
 */
@Injectable()
export class NotificationService implements NotificationPort {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationOutboxTypeormEntity)
    private readonly outboxRepository: Repository<NotificationOutboxTypeormEntity>
  ) {}

  /**
   * @param manager TypeORM EntityManager вызывающей транзакции. Если передан —
   * outbox пишется в той же транзакции (откат вызывающего ⇒ нет уведомления).
   * Иначе пишется отдельным атомарным батчем (at-least-once).
   */
  async notify(input: NotifyInput, manager?: EntityManager): Promise<NotifyResult> {
    const channels = this.resolveChannels(input.workflowId);
    if (channels.length === 0) {
      this.logger.warn(`Тип уведомления '${input.workflowId}' не имеет активных каналов — пропуск`);
      return { acknowledged: false, outboxIds: [] };
    }

    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    const rows: Partial<NotificationOutboxTypeormEntity>[] = [];

    for (const recipient of recipients) {
      for (const channel of channels) {
        // email-канал требует подтверждённого адреса (gate); иначе строку не плодим.
        if (channel === NotificationChannel.EMAIL && !recipient.email) continue;
        rows.push(this.buildRow(input, recipient, channel));
      }
    }

    if (rows.length === 0) return { acknowledged: false, outboxIds: [] };

    const repository = manager ? manager.getRepository(NotificationOutboxTypeormEntity) : this.outboxRepository;

    // ON CONFLICT DO NOTHING по unique(idempotencyKey): повторный notify() с тем же
    // ключом не плодит строк. returning('id') отдаёт id только реально вставленных.
    const result = await repository
      .createQueryBuilder()
      .insert()
      .into(NotificationOutboxTypeormEntity)
      .values(rows)
      .orIgnore()
      .returning('id')
      .execute();

    const outboxIds = (result.raw as Array<{ id: string }>).map((r) => r.id);
    return { acknowledged: true, outboxIds };
  }

  /** Каналы доставки типа уведомления из каталога (steps[].type), только активные в MVP, без дублей. */
  private resolveChannels(workflowId: string): NotificationChannel[] {
    const definition = Workflows.workflowsById[workflowId];
    if (!definition) {
      this.logger.warn(`Тип уведомления '${workflowId}' не найден в каталоге @coopenomics/notifications`);
      return [];
    }
    const channels = new Set<NotificationChannel>();
    for (const step of definition.steps) {
      const channel = step.type as NotificationChannel;
      if (ACTIVE_CHANNELS.includes(channel)) channels.add(channel);
    }
    return [...channels];
  }

  private buildRow(
    input: NotifyInput,
    recipient: NotifyRecipient,
    channel: NotificationChannel
  ): Partial<NotificationOutboxTypeormEntity> {
    return {
      coopname: input.coopname,
      workflowId: input.workflowId,
      channel,
      recipientSubscriberId: recipient.subscriberId,
      recipientEmail: recipient.email,
      recipientUsername: recipient.username,
      payload: input.payload,
      actorSubscriberId: input.actor?.subscriberId,
      idempotencyKey: this.computeIdempotencyKey(input, recipient, channel),
      status: NotificationOutboxStatus.PENDING,
      attempts: 0,
      maxAttempts: 5,
      scheduledAt: new Date(),
    };
  }

  /**
   * Ключ идемпотентности (story 1.5):
   * sha256(coopname | workflowId | subscriberId | channel | stable(payload)).
   * Канал входит в ключ — одна строка на канал (иначе fan-out на 2+ канала
   * ловит unique-индекс). payload сериализуется детерминированно (сортировка ключей),
   * чтобы перестановка полей не меняла ключ.
   */
  private computeIdempotencyKey(input: NotifyInput, recipient: NotifyRecipient, channel: NotificationChannel): string {
    const material = [
      input.coopname,
      input.workflowId,
      recipient.subscriberId,
      channel,
      stableStringify(input.payload ?? {}),
    ].join('|');
    return createHash('sha256').update(material).digest('hex');
  }
}

/** Детерминированная сериализация: ключи объектов сортируются рекурсивно. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(',')}}`;
}
