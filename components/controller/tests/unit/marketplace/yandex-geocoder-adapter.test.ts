// Unit-тесты YandexGeocoderAdapter — конкретная реализация GeocoderPort.
// Покрывают: happy-path, пустой featureMember, HTTP 500, сетевую ошибку,
// отсутствие GEOCODER_API_KEY и rate-limit sliding-window.
import { YandexGeocoderAdapter } from '~/extensions/marketplace/infrastructure/adapters/yandex-geocoder.adapter';

// Настройки службы адаптер получает аргументом: их отдаёт ядро через порт
// доступов к внешним службам, а не конфиг контроллера.
const settings = {
  api_key: 'test-key',
  base_url: 'https://geocode-maps.yandex.ru/1.x/',
  rate_limit_rps: 10,
  timeout_ms: 5000,
} as any;

interface FetchMock {
  (input: string, init?: any): Promise<any>;
  calls: Array<{ url: string; init?: any }>;
}

function installFetch(response: { ok: boolean; status?: number; statusText?: string; body?: unknown; throws?: unknown }): FetchMock {
  const fn = jest.fn(async (_url: string, _init?: any) => {
    if (response.throws) throw response.throws;
    return {
      ok: response.ok,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      json: async () => response.body,
    };
  }) as unknown as FetchMock;
  (fn as any).calls = (fn as any).mock.calls;
  (globalThis as any).fetch = fn;
  return fn;
}

describe('YandexGeocoderAdapter', () => {
  let adapter: YandexGeocoderAdapter;

  beforeEach(() => {
    adapter = new YandexGeocoderAdapter(settings);
  });

  it('happy-path парсит pos в lat/lng', async () => {
    installFetch({
      ok: true,
      body: {
        response: {
          GeoObjectCollection: {
            featureMember: [{ GeoObject: { Point: { pos: '37.617299 55.755826' } } }],
          },
        },
      },
    });
    const r = await adapter.geocode('г. Москва, ул. Тверская, 1');
    expect(r.status).toBe('OK');
    if (r.status === 'OK') {
      expect(r.lat).toBeCloseTo(55.755826, 5);
      expect(r.lng).toBeCloseTo(37.617299, 5);
    }
  });

  it('пустой featureMember → FAILED', async () => {
    installFetch({ ok: true, body: { response: { GeoObjectCollection: { featureMember: [] } } } });
    const r = await adapter.geocode('???');
    expect(r.status).toBe('FAILED');
    if (r.status === 'FAILED') expect(r.errorMessage).toMatch(/пустой результат/);
  });

  it('HTTP 500 → FAILED с кодом', async () => {
    installFetch({ ok: false, status: 500, statusText: 'Internal Server Error' });
    const r = await adapter.geocode('addr');
    expect(r.status).toBe('FAILED');
    if (r.status === 'FAILED') expect(r.errorMessage).toMatch(/HTTP 500/);
  });

  it('fetch throws → FAILED с сообщением', async () => {
    installFetch({ ok: true, throws: new Error('ECONNREFUSED') });
    const r = await adapter.geocode('addr');
    expect(r.status).toBe('FAILED');
    if (r.status === 'FAILED') expect(r.errorMessage).toBe('ECONNREFUSED');
  });

  it('отсутствие GEOCODER_API_KEY → FAILED без HTTP-запроса', async () => {
    const fetchSpy = installFetch({ ok: true, body: {} });
    const r = await new YandexGeocoderAdapter({ ...settings, api_key: undefined }).geocode('addr');
    expect(r.status).toBe('FAILED');
    if (r.status === 'FAILED') expect(r.errorMessage).toMatch(/GEOCODER_API_KEY не задан/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rate-limit: 11-й запрос ждёт до следующего окна', async () => {
    installFetch({
      ok: true,
      body: {
        response: {
          GeoObjectCollection: {
            featureMember: [{ GeoObject: { Point: { pos: '0 0' } } }],
          },
        },
      },
    });
    const start = Date.now();
    const batch = await Promise.all(
      new Array(11).fill(0).map((_, i) => adapter.geocode(`addr-${i}`))
    );
    const elapsed = Date.now() - start;
    expect(batch.every((r) => r.status === 'OK')).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(800);
  }, 15000);
});
