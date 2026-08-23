import type { Event } from '@sentry/node';
import { scrubSensitiveDataFromSentryEvent } from './sentry-scrub-event';

/**
 * Story 9.12: путь в Sentry покрыт той же redaction, что и логи (Story 8.7).
 * Прикладные данные в `extra`/`contexts` маскируются по секрет-ключам на любой
 * глубине; транспортные заголовки — специализированным списком.
 */
describe('scrubSensitiveDataFromSentryEvent — секреты в Sentry-событии (Story 9.12)', () => {
  it('маскирует секрет-ключи в event.extra на любой глубине', () => {
    const event = {
      extra: {
        password: 'p-secret',
        vault: { privateKey: 'pk-secret' },
        user_id: '42',
        note: 'ok',
      },
    } as unknown as Event;

    scrubSensitiveDataFromSentryEvent(event);

    const extra = event.extra as Record<string, unknown>;
    expect(extra.password).toBe('[REDACTED]');
    expect((extra.vault as Record<string, unknown>).privateKey).toBe('[REDACTED]');
    expect(extra.user_id).toBe('42');
    expect(extra.note).toBe('ok');
  });

  it('маскирует секрет-ключи в event.contexts', () => {
    const event = {
      contexts: {
        custom: { token: 'tok-secret', request_id: 'r-9' },
      },
    } as unknown as Event;

    scrubSensitiveDataFromSentryEvent(event);

    const custom = (event.contexts as Record<string, Record<string, unknown>>).custom;
    expect(custom.token).toBe('[REDACTED]');
    expect(custom.request_id).toBe('r-9');
  });

  it('по-прежнему чистит транспортные заголовки в event.request.headers', () => {
    const event = {
      request: {
        headers: { authorization: 'Bearer xyz', 'content-type': 'application/json' },
      },
    } as unknown as Event;

    scrubSensitiveDataFromSentryEvent(event);

    const headers = (event.request as { headers: Record<string, string> }).headers;
    expect(headers.authorization).toBe('[REDACTED]');
    expect(headers['content-type']).toBe('application/json');
  });

  it('событие без extra/contexts/request не падает', () => {
    const event = { message: 'plain error' } as unknown as Event;
    expect(() => scrubSensitiveDataFromSentryEvent(event)).not.toThrow();
    expect(event.message).toBe('plain error');
  });
});
