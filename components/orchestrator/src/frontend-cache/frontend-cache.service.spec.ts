/**
 * @fileoverview Юнит-тесты FrontendCacheService (E12-2) — на настоящей ФС
 * (mkdtemp), source/verifier — фейки.
 *
 * Покрытие:
 *  - ok → запись install.js+meta.json, list/read/isCached видят;
 *  - sha256 содержимого ≠ X-Install-Script-Sha256 → rejected, кэш пуст;
 *  - manifest-декларация ≠ sha256 → rejected; старый кэш не затёрт;
 *  - verifier бросил (сеть) → fail-closed rejected, старый кэш жив;
 *  - verifier вернул null (sha не декларирован) → cached;
 *  - notFound от источника → evict существующей записи;
 *  - unavailable → skipped, существующая запись жива;
 *  - evict идемпотентен; read невалидных координат → null;
 *  - packageId без @scope/name → skipped.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { FrontendCacheService } from './frontend-cache.service';
import type {
  FrontendInstallFetchOutcome,
  FrontendInstallSourcePort,
  FrontendManifestVerifierPort,
} from './ports';

const PKG = '@voskhod/demo-app';
const CODE = Buffer.from('module.exports = { install: () => [] };\n');
const SHA = createHash('sha256').update(CODE).digest('hex');

class FakeSource implements FrontendInstallSourcePort {
  outcome: FrontendInstallFetchOutcome = {
    status: 'ok',
    content: CODE,
    declaredSha256: SHA,
    version: '1.2.0',
  };
  calls: Array<{ scope: string; name: string }> = [];
  async fetchInstallScript(scope: string, name: string): Promise<FrontendInstallFetchOutcome> {
    this.calls.push({ scope, name });
    return this.outcome;
  }
}

class FakeVerifier implements FrontendManifestVerifierPort {
  sha: string | null = null;
  error: Error | null = null;
  calls: Array<{ packageId: string; version: string }> = [];
  async fetchInstallSha256(packageId: string, version: string): Promise<string | null> {
    this.calls.push({ packageId, version });
    if (this.error !== null) throw this.error;
    return this.sha;
  }
}

describe('FrontendCacheService', () => {
  let dir: string;
  let source: FakeSource;
  let verifier: FakeVerifier;
  let service: FrontendCacheService;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'fe-cache-'));
    source = new FakeSource();
    verifier = new FakeVerifier();
    service = new FrontendCacheService(dir, source, verifier);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('ok → кэширует, list/read/isCached видят запись с версией и sha', async () => {
    const outcome = await service.syncPackage(PKG);
    expect(outcome.status).toBe('cached');
    expect(source.calls).toEqual([{ scope: 'voskhod', name: 'demo-app' }]);

    expect(await service.isCached(PKG)).toBe(true);
    const list = await service.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      packageId: PKG,
      scope: 'voskhod',
      name: 'demo-app',
      version: '1.2.0',
      sha256: SHA,
    });

    const read = await service.read('voskhod', 'demo-app');
    expect(read?.content.equals(CODE)).toBe(true);
    expect(read?.meta.sha256).toBe(SHA);
  });

  it('sha256 ≠ заголовку ca-admin → rejected, в кэш ничего не пишется', async () => {
    source.outcome = {
      status: 'ok',
      content: CODE,
      declaredSha256: 'f'.repeat(64),
      version: '1.2.0',
    };
    const outcome = await service.syncPackage(PKG);
    expect(outcome.status).toBe('rejected');
    expect(await service.isCached(PKG)).toBe(false);
  });

  it('manifest-декларация ≠ sha256 → rejected; старая версия в кэше живёт', async () => {
    await service.syncPackage(PKG); // прогрев валидной версией

    verifier.sha = 'a'.repeat(64);
    source.outcome = {
      status: 'ok',
      content: Buffer.from('tampered'),
      declaredSha256: createHash('sha256').update('tampered').digest('hex'),
      version: '1.3.0',
    };
    const outcome = await service.syncPackage(PKG);
    expect(outcome.status).toBe('rejected');

    const read = await service.read('voskhod', 'demo-app');
    expect(read?.meta.version).toBe('1.2.0');
    expect(read?.content.equals(CODE)).toBe(true);
  });

  it('verifier бросил → fail-closed rejected, старый кэш жив', async () => {
    await service.syncPackage(PKG);
    verifier.error = new Error('ECONNREFUSED ca-auth');
    const outcome = await service.syncPackage(PKG);
    expect(outcome.status).toBe('rejected');
    expect((await service.read('voskhod', 'demo-app'))?.meta.version).toBe('1.2.0');
  });

  it('verifier вернул null (sha не декларирован) → cached', async () => {
    verifier.sha = null;
    const outcome = await service.syncPackage(PKG);
    expect(outcome.status).toBe('cached');
    expect(verifier.calls).toEqual([{ packageId: PKG, version: '1.2.0' }]);
  });

  it('без verifier (degraded) → принимаем по заголовку', async () => {
    const noVerifier = new FrontendCacheService(dir, source, null);
    expect((await noVerifier.syncPackage(PKG)).status).toBe('cached');
  });

  it('notFound от источника → существующая запись evict-ится', async () => {
    await service.syncPackage(PKG);
    source.outcome = { status: 'notFound', reason: '404' };
    const outcome = await service.syncPackage(PKG);
    expect(outcome.status).toBe('evicted');
    expect(await service.isCached(PKG)).toBe(false);
    expect(await service.list()).toEqual([]);
  });

  it('unavailable → skipped, существующая запись остаётся', async () => {
    await service.syncPackage(PKG);
    source.outcome = { status: 'unavailable', reason: 'каталог лёг' };
    const outcome = await service.syncPackage(PKG);
    expect(outcome.status).toBe('skipped');
    expect(await service.isCached(PKG)).toBe(true);
  });

  it('evict идемпотентен; read мусорных координат → null', async () => {
    await service.evict(PKG); // ничего нет — не падает
    await service.syncPackage(PKG);
    await service.evict(PKG);
    await service.evict(PKG);
    expect(await service.isCached(PKG)).toBe(false);
    expect(await service.read('..', 'demo-app')).toBeNull();
    expect(await service.read('voskhod', '../../etc')).toBeNull();
  });

  it('packageId без @scope/name → skipped, источник не дёргается', async () => {
    const outcome = await service.syncPackage('plain-name');
    expect(outcome.status).toBe('skipped');
    expect(source.calls).toEqual([]);
  });
});
