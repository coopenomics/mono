// Unit-тесты фабрики geocoderPortFactory: выбор реализации по настройке
// `provider`. Noop-провайдер всегда отвечает FAILED.
//
// Настройки геокодера расширение получает от ядра через порт доступов к
// внешним службам и передаёт их фабрике аргументом, поэтому подменять конфиг
// контроллера здесь больше не нужно — достаточно передать другой объект.

import { geocoderPortFactory } from '~/extensions/marketplace/infrastructure/adapters/geocoder.factory';

describe('geocoderPortFactory', () => {
  it('provider=noop → NoopGeocoderAdapter', async () => {
    const port = geocoderPortFactory({
      provider: 'noop',
      rate_limit_rps: 10,
      timeout_ms: 5000,
    } as any);
    expect(port.constructor.name).toBe('NoopGeocoderAdapter');
    const r = await port.geocode('addr');
    expect(r.status).toBe('FAILED');
    if (r.status === 'FAILED') expect(r.errorMessage).toMatch(/GEOCODER_PROVIDER=noop/);
  });

  it('provider=yandex → YandexGeocoderAdapter', () => {
    const port = geocoderPortFactory({
      provider: 'yandex',
      api_key: 'k',
      base_url: 'https://geocode-maps.yandex.ru/1.x/',
      rate_limit_rps: 10,
      timeout_ms: 5000,
    } as any);
    expect(port.constructor.name).toBe('YandexGeocoderAdapter');
  });

  it('службы нет в разрешённых → noop, а не падение', async () => {
    const port = geocoderPortFactory(null);
    expect(port.constructor.name).toBe('NoopGeocoderAdapter');
    const r = await port.geocode('addr');
    expect(r.status).toBe('FAILED');
  });
});
