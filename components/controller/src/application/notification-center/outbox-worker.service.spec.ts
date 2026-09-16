import { OutboxWorkerService, transportBackoffMs } from './outbox-worker.service';
import {
  NotificationDeliveryStatus,
  NotificationOutboxStatus,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import type { ChannelDeliveryResult } from '~/domain/notification/interfaces/channel.ports';

/**
 * Падение канала не должно хоронить письмо (инцидент 08.09.2026: почтовый шлюз
 * лежал почти два часа, ретраи выгорели за 17 минут, четыре кода подтверждения
 * умерли и после возвращения шлюза не досылались).
 */
describe('OutboxWorkerService — письма переживают падение канала', () => {
  const HOUR_MS = 60 * 60 * 1000;

  /** Строка очереди на последней разрешённой попытке — та, что раньше умирала. */
  function makeRow(attempts = 4) {
    return {
      id: 'outbox-1',
      coopname: 'voskhod',
      channel: NotificationChannel.EMAIL,
      workflowId: 'verifikatsiya-email',
      recipientSubscriberId: 'sub-1',
      recipientUsername: 'pgrzosdeyuwg',
      recipientEmail: 'po-chest@mail.ru',
      payload: {},
      status: NotificationOutboxStatus.PENDING,
      attempts,
      maxAttempts: 5,
      scheduledAt: new Date('2026-09-08T09:00:00Z'),
      createdAt: new Date('2026-09-08T09:00:00Z'),
    };
  }

  function setup(result: ChannelDeliveryResult) {
    const outboxRepository = { save: jest.fn(async (row: unknown) => row) };
    const deliveryRepository = { save: jest.fn(), create: jest.fn((x: unknown) => x) };
    const emailChannel = { send: jest.fn(async () => result) };
    const service = new OutboxWorkerService(
      outboxRepository as never,
      deliveryRepository as never,
      emailChannel as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never
    );
    return { service, outboxRepository, deliveryRepository, emailChannel };
  }

  /** processRow приватный: дёргаем через индекс — публичного входа у него нет. */
  function processRow(service: OutboxWorkerService, row: unknown, now: Date) {
    return (service as unknown as { processRow(r: unknown, n: Date): Promise<void> }).processRow(row, now);
  }

  it('канал лежит: последняя по счёту попытка не хоронит письмо, лимит не тратится', async () => {
    const { service, deliveryRepository } = setup({
      delivered: false,
      error: 'HTTP 504',
      transportUnavailable: true,
    });
    const row = makeRow();
    const now = new Date('2026-09-08T09:30:00Z');

    await processRow(service, row, now);

    // Было 4 из 5 — после захода в лежащий канал столько же, строка ждёт дальше.
    expect(row.status).toBe(NotificationOutboxStatus.PENDING);
    expect(row.attempts).toBe(4);
    expect(row.scheduledAt.getTime()).toBeGreaterThan(now.getTime());
    // Журнал доставок такими заходами не засоряется.
    expect(deliveryRepository.save).not.toHaveBeenCalled();
  });

  it('канал вернулся — ждавшее письмо уходит и помечается доставленным', async () => {
    const { service, deliveryRepository } = setup({ delivered: true, providerResponse: '<mid@coop>' });
    const row = makeRow(4);

    await processRow(service, row, new Date('2026-09-08T11:00:00Z'));

    expect(row.status).toBe(NotificationOutboxStatus.SENT);
    expect(deliveryRepository.save).toHaveBeenCalledTimes(1);
    expect(deliveryRepository.save.mock.calls[0][0]).toMatchObject({
      status: NotificationDeliveryStatus.SENT,
    });
  });

  it('канала не было сутки — письмо всё же закрывается как проваленное', async () => {
    const { service, deliveryRepository } = setup({
      delivered: false,
      error: 'HTTP 504',
      transportUnavailable: true,
    });
    const row = makeRow();
    // Окно доставки — 24 часа от постановки в очередь.
    const now = new Date(new Date(row.createdAt).getTime() + 25 * HOUR_MS);

    await processRow(service, row, now);

    expect(row.status).toBe(NotificationOutboxStatus.FAILED);
    expect(deliveryRepository.save).toHaveBeenCalledTimes(1);
  });

  it('отказ по существу письма считается в лимит и хоронит его как раньше', async () => {
    const { service } = setup({ delivered: false, error: 'no email template' });
    const row = makeRow(4);

    await processRow(service, row, new Date('2026-09-08T09:30:00Z'));

    // 4 + 1 = 5 = maxAttempts: повтор такого отказа ничего не изменит.
    expect(row.attempts).toBe(5);
    expect(row.status).toBe(NotificationOutboxStatus.FAILED);
  });

  it('пауза до следующего стука растёт с временем ожидания и упирается в 10 минут', () => {
    expect(transportBackoffMs(30_000)).toBe(30_000);
    expect(transportBackoffMs(5 * 60_000)).toBe(60_000);
    expect(transportBackoffMs(20 * 60_000)).toBe(120_000);
    expect(transportBackoffMs(60 * 60_000)).toBe(300_000);
    expect(transportBackoffMs(6 * HOUR_MS)).toBe(600_000);
  });
});
