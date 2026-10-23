/**
 * @fileoverview Юнит-тесты CaAdminInstallSource (E12-2) — транспорт
 * подменяется fetch-стабом, сети нет.
 */
import { CaAdminInstallSource, NoopInstallSource } from './ca-admin-install-source.impl';

interface RecordedRequest {
  url: string;
  init: RequestInit;
}

class StubbedSource extends CaAdminInstallSource {
  requests: RecordedRequest[] = [];
  constructor(private readonly handler: () => Promise<Response>) {
    super({ baseUrl: 'http://ca-admin:3000', apiKey: 'admin-key' });
  }
  protected override fetch(url: string, init: RequestInit): Promise<Response> {
    this.requests.push({ url, init });
    return this.handler();
  }
}

describe('CaAdminInstallSource', () => {
  it('200 → ok с телом и заголовками sha256/version; путь и Bearer корректны', async () => {
    const source = new StubbedSource(async () =>
      new Response('module.exports = 1;', {
        status: 200,
        headers: {
          'X-Install-Script-Sha256': 'a'.repeat(64),
          'X-Package-Version': '1.2.0',
        },
      }),
    );
    const outcome = await source.fetchInstallScript('voskhod', 'demo-app');
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.content.toString()).toBe('module.exports = 1;');
      expect(outcome.declaredSha256).toBe('a'.repeat(64));
      expect(outcome.version).toBe('1.2.0');
    }
    expect(source.requests[0]?.url).toBe(
      'http://ca-admin:3000/v1/public/packages/voskhod/demo-app/install.js',
    );
    expect(
      (source.requests[0]?.init.headers as Record<string, string>).Authorization,
    ).toBe('Bearer admin-key');
  });

  it('200 без заголовков → ok с null-полями (кэш примет по содержимому)', async () => {
    const source = new StubbedSource(async () => new Response('x', { status: 200 }));
    const outcome = await source.fetchInstallScript('voskhod', 'demo-app');
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.declaredSha256).toBeNull();
      expect(outcome.version).toBeNull();
    }
  });

  it('404 → notFound; 503 → unavailable; сеть → unavailable', async () => {
    const nf = new StubbedSource(async () => new Response('no', { status: 404 }));
    expect((await nf.fetchInstallScript('voskhod', 'gone')).status).toBe('notFound');

    const down = new StubbedSource(async () => new Response('oops', { status: 503 }));
    expect((await down.fetchInstallScript('voskhod', 'demo-app')).status).toBe('unavailable');

    const net = new StubbedSource(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect((await net.fetchInstallScript('voskhod', 'demo-app')).status).toBe('unavailable');
  });

  it('NoopInstallSource → unavailable с понятной причиной', async () => {
    const outcome = await new NoopInstallSource().fetchInstallScript();
    expect(outcome.status).toBe('unavailable');
    if (outcome.status === 'unavailable') {
      expect(outcome.reason).toMatch(/APPS_CATALOG_URL/);
    }
  });
});
