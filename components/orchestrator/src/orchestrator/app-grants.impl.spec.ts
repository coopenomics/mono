/**
 * Заявки приложений в ядре (487-17, 487-37): запрос ключа, отказ без согласия
 * председателя и адрес входа портов для контейнера приложения.
 */
import { HttpAppGrants } from './app-grants.impl';
import { AppConsentRequiredError } from './ports';

const PKG = '@voskhod/exampleapp';
const REQUEST = { packageId: PKG, version: '0.2.0', ports: ['document'], chainActions: ['eosio::refund'] };

function respond(status: number, body: unknown = {}): typeof fetch {
  return jest.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('HttpAppGrants', () => {
  it('happy: запрос ключа несёт секрет узла, права и версию; ядро отдаёт токен', async () => {
    const fetchFn = respond(200, { token: 'apt_1' });
    const grants = new HttpAppGrants('http://coopback:2998', 'node-secret', fetchFn);
    expect(await grants.issue(REQUEST)).toBe('apt_1');
    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe('http://coopback:2998/v1/internal/app-grants/voskhod/exampleapp');
    expect(init.method).toBe('PUT');
    expect(init.headers['server-secret']).toBe('node-secret');
    expect(JSON.parse(init.body)).toEqual({ ports: ['document'], chain_actions: ['eosio::refund'], version: '0.2.0' });
  });

  it('break: ядро ответило 409 — отдельная ошибка ожидания согласия председателя', async () => {
    const grants = new HttpAppGrants('http://coopback:2998', 'node-secret', respond(409));
    await expect(grants.issue(REQUEST)).rejects.toBeInstanceOf(AppConsentRequiredError);
  });

  it('break: прочий отказ ядра и ответ без токена — обычная ошибка установки', async () => {
    const down = new HttpAppGrants('http://coopback:2998', 'node-secret', respond(503));
    await expect(down.issue(REQUEST)).rejects.toThrow(/HTTP 503/);
    const empty = new HttpAppGrants('http://coopback:2998', 'node-secret', respond(200, {}));
    await expect(empty.issue(REQUEST)).rejects.toThrow(/не вернуло токен/);
  });

  it('side: узел с закрытой сетью приложений — контейнер получает адрес шлюза портов, заявки идут в ядро', async () => {
    const fetchFn = respond(200, { token: 'apt_1' });
    const grants = new HttpAppGrants('http://coopback:2998', 'node-secret', fetchFn, 'http://core-ports:8090');
    expect(grants.coreUrl).toBe('http://core-ports:8090');
    await grants.issue(REQUEST);
    expect((fetchFn as unknown as jest.Mock).mock.calls[0][0]).toBe('http://coopback:2998/v1/internal/app-grants/voskhod/exampleapp');
  });

  it('side: адрес шлюза портов не задан — контейнер получает адрес ядра', () => {
    expect(new HttpAppGrants('http://coopback:2998', 'node-secret', respond(200)).coreUrl).toBe('http://coopback:2998');
    expect(new HttpAppGrants('http://coopback:2998', 'node-secret', respond(200), '').coreUrl).toBe('http://coopback:2998');
  });

  it('side: снятие заявки не бросает при отказе ядра — контейнер всё равно снимается', async () => {
    const grants = new HttpAppGrants('http://coopback:2998', 'node-secret', respond(500));
    await expect(grants.revoke(PKG)).resolves.toBeUndefined();
  });
});
