/**
 * Шлюз не отдаёт наружу адреса контейнеров и причины сети (25.11.2026):
 * при упавшем приложении клиент получал «connect ECONNREFUSED 172.18.0.15:3011».
 */
import { maskSubgraphFailure } from './gateway.module';

describe('maskSubgraphFailure', () => {
  it('break: отказ связи с приложением — адрес контейнера и причина сети наружу не отдаются', () => {
    const masked = maskSubgraphFailure({
      message: 'request to http://ext-exampleapp:3011/v1/graphql failed, reason: connect ECONNREFUSED 172.18.0.15:3011',
      extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['FetchError: …'] },
      path: ['exampleAppNotes'],
    });
    expect(masked.message).toBe('Часть сервиса временно недоступна. Повторите запрос позже.');
    expect(JSON.stringify(masked)).not.toMatch(/ext-exampleapp|172\.18|ECONNREFUSED|stacktrace/);
    expect(masked.extensions).toEqual({ code: 'SERVICE_UNAVAILABLE' });
    // Путь поля остаётся: клиент видит, какая часть ответа не получена.
    expect(masked.path).toEqual(['exampleAppNotes']);
  });

  it('happy: отказ сервиса по правам или данным проходит как есть — его текст и код для пайщика', () => {
    const refusal = {
      message: 'Приложение @voskhod/exampleapp не заявляло порт account',
      extensions: { code: 'APPS_CATALOG_PROXY_APP_PORT_NOT_GRANTED' },
    };
    expect(maskSubgraphFailure(refusal)).toBe(refusal);
  });

  it('side: имя не найдено в сети узла (приложение ещё не поднялось) — тоже без имени контейнера', () => {
    const masked = maskSubgraphFailure({ message: 'getaddrinfo EAI_AGAIN ext-exampleapp' });
    expect(masked.message).not.toContain('ext-exampleapp');
  });
});
