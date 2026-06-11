import type { Event } from '@sentry/node';
import { redactSensitiveHttpHeaders } from './redact-sensitive-http-headers';
import { redactSensitive } from '~/config/log-redaction';

/**
 * Убирает секреты из события Sentry перед отправкой в облако и перед логированием.
 * Мутирует переданный event (так работает beforeSend).
 *
 * Story 9.12: путь в Sentry — отдельный канал утечки, его покрывает та же redaction,
 * что и логи (Story 8.7). Транспортные заголовки чистятся специализированным списком
 * (`redactSensitiveHttpHeaders`), а прикладные данные `extra`/`contexts` (куда сервис
 * кладёт user_id, request_id, доменный контекст ошибки) — общим `redactSensitive`:
 * секрет-ключи на любой глубине → `[REDACTED]` (AC «stack trace без secrets из 8.7»).
 */
export function scrubSensitiveDataFromSentryEvent(event: Event): Event {
  if (event.request?.headers) {
    const redacted = redactSensitiveHttpHeaders(event.request.headers as Record<string, unknown>);
    if (redacted) {
      event.request.headers = redacted;
    }
  }

  if (event.extra) {
    event.extra = redactSensitive(event.extra);
  }
  if (event.contexts) {
    event.contexts = redactSensitive(event.contexts);
  }

  const breadcrumbs = event.breadcrumbs;
  if (breadcrumbs) {
    for (const b of breadcrumbs) {
      if (b.data && typeof b.data === 'object' && b.data !== null && 'headers' in b.data) {
        const data = b.data as Record<string, unknown>;
        const rh = redactSensitiveHttpHeaders(data.headers as Record<string, unknown>);
        if (rh) {
          data.headers = rh;
        }
      }
    }
  }

  return event;
}
