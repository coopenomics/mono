// Unit-тесты фабрики geocoderPortFactory: выбор реализации по
// config.geocoder.provider. Noop-провайдер всегда отвечает FAILED.

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    geocoder: {
      provider: 'noop',
      api_key: undefined,
      base_url: undefined,
      rate_limit_rps: 10,
      timeout_ms: 5000,
    },
  },
}));

import { NoopGeocoderAdapter } from '~/extensions/marketplace/infrastructure/adapters/noop-geocoder.adapter';
import { YandexGeocoderAdapter } from '~/extensions/marketplace/infrastructure/adapters/yandex-geocoder.adapter';

describe('geocoderPortFactory', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('provider=noop → NoopGeocoderAdapter', async () => {
    const { geocoderPortFactory } = await import(
      '~/extensions/marketplace/infrastructure/adapters/geocoder.factory'
    );
    const port = geocoderPortFactory();
    expect(port).toBeInstanceOf(NoopGeocoderAdapter);
    const r = await port.geocode('addr');
    expect(r.status).toBe('FAILED');
    if (r.status === 'FAILED') expect(r.errorMessage).toMatch(/GEOCODER_PROVIDER=noop/);
  });

  it('provider=yandex → YandexGeocoderAdapter', async () => {
    jest.resetModules();
    jest.doMock('~/config/config', () => ({
      __esModule: true,
      default: {
        geocoder: {
          provider: 'yandex',
          api_key: 'k',
          base_url: 'https://geocode-maps.yandex.ru/1.x/',
          rate_limit_rps: 10,
          timeout_ms: 5000,
        },
      },
    }));
    const { geocoderPortFactory } = await import(
      '~/extensions/marketplace/infrastructure/adapters/geocoder.factory'
    );
    const port = geocoderPortFactory();
    expect(port).toBeInstanceOf(YandexGeocoderAdapter);
  });
});
