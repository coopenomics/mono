/**
 * @fileoverview Юнит-тесты on-chain watcher'а.
 *
 * Покрытие (Story 10.5):
 *  - release-published scope='all' → install зовётся;
 *  - release-published scope='cooperatives' с нашим coopname → install;
 *  - release-published scope='cooperatives' без нашего coopname → ignore;
 *  - release-published scope='empty' → ignore;
 *  - release-published metadata=null → install не зовётся (skip + warn);
 *  - subscription-activated для нашего coop → install зовётся;
 *  - subscription-activated для чужого coop → ignore;
 *  - release-withdrawn → registry.deactivate;
 *  - subscription-expired для нашего coop → registry.deactivate;
 *  - subscription-expired для чужого coop → ignore.
 *
 * E12-2 (кэш фронт-частей):
 *  - subscription-activated нашего coop → frontendCache.syncPackage,
 *    в том числе для frontend-only пакета (metadata=null);
 *  - subscription-expired нашего coop → frontendCache.evict;
 *  - release-published: syncPackage только для уже закэшированных;
 *  - release-withdrawn: syncPackage для закэшированных (сам разрулит
 *    «другой активный релиз vs evict»).
 */
import {
  AppsContractEvent,
  AppsContractEventStreamPort,
  ReleaseInstallSpec,
  ReleaseMetadataPort,
} from './ports';
import {
  OnChainWatcherService,
  OnChainWatcherConfig,
} from './on-chain-watcher.service';
import {
  InstallOrchestratorService,
  InstallExtensionInput,
  InstallOutcome,
} from '../orchestrator/install-orchestrator.service';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';
import { FrontendCacheService } from '../frontend-cache/frontend-cache.service';

class FakeFrontendCache {
  cachedIds = new Set<string>();
  synced: string[] = [];
  evicted: string[] = [];
  async syncPackage(packageId: string): Promise<unknown> {
    this.synced.push(packageId);
    return { status: 'cached', packageId, version: '1.0.0', sha256: 'x' };
  }
  async evict(packageId: string): Promise<void> {
    this.evicted.push(packageId);
  }
  async isCached(packageId: string): Promise<boolean> {
    return this.cachedIds.has(packageId);
  }
}

class FakeEventStream implements AppsContractEventStreamPort {
  handler?: (e: AppsContractEvent) => Promise<void>;
  async subscribe(handler: (e: AppsContractEvent) => Promise<void>): Promise<{ unsubscribe(): void }> {
    this.handler = handler;
    return { unsubscribe: () => undefined };
  }
}

class FakeMetadata implements ReleaseMetadataPort {
  byKey = new Map<string, ReleaseInstallSpec>();
  calls: Array<{ packageId: string; version: string }> = [];
  setSpec(packageId: string, version: string, spec: ReleaseInstallSpec): void {
    this.byKey.set(`${packageId}@${version}`, spec);
  }
  async fetchInstallSpec(opts: { packageId: string; version: string }): Promise<ReleaseInstallSpec | null> {
    this.calls.push(opts);
    return this.byKey.get(`${opts.packageId}@${opts.version}`) ?? null;
  }
}

class FakeOrchestrator {
  calls: Array<InstallExtensionInput> = [];
  outcome: InstallOutcome = { status: 'applied', packageId: '', healthAfterMs: 1 };
  async install(input: InstallExtensionInput): Promise<InstallOutcome> {
    this.calls.push(input);
    return { ...this.outcome, packageId: input.packageId };
  }
}

class FakeRegistryService {
  deactivated: string[] = [];
  async deactivate(packageId: string): Promise<void> {
    this.deactivated.push(packageId);
  }
}

const buildHarness = (
  cfg: Partial<OnChainWatcherConfig> = {},
): {
  watcher: OnChainWatcherService;
  stream: FakeEventStream;
  metadata: FakeMetadata;
  orchestrator: FakeOrchestrator;
  registry: FakeRegistryService;
  frontendCache: FakeFrontendCache;
} => {
  const stream = new FakeEventStream();
  const metadata = new FakeMetadata();
  const orchestrator = new FakeOrchestrator();
  const registry = new FakeRegistryService();
  const frontendCache = new FakeFrontendCache();
  const watcher = new OnChainWatcherService(
    stream,
    metadata,
    { coopname: 'voskhod', ...cfg },
    orchestrator as unknown as InstallOrchestratorService,
    registry as unknown as SubgraphRegistryService,
    frontendCache as unknown as FrontendCacheService,
  );
  return { watcher, stream, metadata, orchestrator, registry, frontendCache };
};

const PACKAGE_ID = '@coopenomics/chatcoop';
const VERSION = '1.0.0';
const SPEC: ReleaseInstallSpec = {
  url: 'http://chatcoop:3000/graphql',
  imageRef: 'reg.local/chatcoop:1.0.0',
};

describe('OnChainWatcherService', () => {
  describe('release-published', () => {
    it("scope='all' → install зовётся", async () => {
      const h = buildHarness();
      h.metadata.setSpec(PACKAGE_ID, VERSION, SPEC);
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: VERSION,
        scopeType: 'all',
        blockNum: 100,
      });
      expect(h.orchestrator.calls).toEqual([
        {
          packageId: PACKAGE_ID,
          version: VERSION,
          url: SPEC.url,
          imageRef: SPEC.imageRef,
          composeService: undefined,
          composeFile: undefined,
          cooperativeJwt: undefined,
          coopname: 'voskhod',
        },
      ]);
    });

    it("scope='cooperatives' с нашим coopname → install", async () => {
      const h = buildHarness();
      h.metadata.setSpec(PACKAGE_ID, VERSION, SPEC);
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: VERSION,
        scopeType: 'cooperatives',
        scopeCoopnames: ['voskhod', 'alpha'],
        blockNum: 101,
      });
      expect(h.orchestrator.calls.length).toBe(1);
    });

    it("scope='cooperatives' без нашего coopname → ignore", async () => {
      const h = buildHarness();
      h.metadata.setSpec(PACKAGE_ID, VERSION, SPEC);
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: VERSION,
        scopeType: 'cooperatives',
        scopeCoopnames: ['alpha', 'beta'],
        blockNum: 102,
      });
      expect(h.orchestrator.calls).toEqual([]);
      expect(h.metadata.calls).toEqual([]);
    });

    it("scope='empty' → ignore", async () => {
      const h = buildHarness();
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: VERSION,
        scopeType: 'empty',
        blockNum: 103,
      });
      expect(h.orchestrator.calls).toEqual([]);
    });

    it('metadata=null → install не зовётся (skip + warn)', async () => {
      const h = buildHarness();
      // ничего не setSpec — fetchInstallSpec вернёт null
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: VERSION,
        scopeType: 'all',
        blockNum: 104,
      });
      expect(h.metadata.calls).toEqual([{ packageId: PACKAGE_ID, version: VERSION }]);
      expect(h.orchestrator.calls).toEqual([]);
    });

    it('cooperativeJwt из cfg пробрасывается в install pipeline', async () => {
      const h = buildHarness({ cooperativeJwt: 'jwt-of-voskhod' });
      h.metadata.setSpec(PACKAGE_ID, VERSION, SPEC);
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: VERSION,
        scopeType: 'all',
        blockNum: 105,
      });
      expect(h.orchestrator.calls[0]?.cooperativeJwt).toBe('jwt-of-voskhod');
    });
  });

  describe('subscription-activated', () => {
    it('для нашего coop → install зовётся с version="active"', async () => {
      const h = buildHarness();
      h.metadata.setSpec(PACKAGE_ID, '', SPEC);
      await h.watcher.handle({
        kind: 'subscription-activated',
        coopname: 'voskhod',
        packageId: PACKAGE_ID,
        expiresAtUnix: 1_800_000_000,
        blockNum: 200,
      });
      expect(h.orchestrator.calls.length).toBe(1);
      expect(h.orchestrator.calls[0]?.version).toBe('active');
    });

    it('для чужого coop → ignore', async () => {
      const h = buildHarness();
      await h.watcher.handle({
        kind: 'subscription-activated',
        coopname: 'alpha',
        packageId: PACKAGE_ID,
        expiresAtUnix: 1_800_000_000,
        blockNum: 201,
      });
      expect(h.orchestrator.calls).toEqual([]);
      expect(h.metadata.calls).toEqual([]);
    });
  });

  describe('release-withdrawn', () => {
    it('→ registry.deactivate', async () => {
      const h = buildHarness();
      await h.watcher.handle({
        kind: 'release-withdrawn',
        packageId: PACKAGE_ID,
        version: VERSION,
        blockNum: 300,
      });
      expect(h.registry.deactivated).toEqual([PACKAGE_ID]);
    });
  });

  describe('subscription-expired', () => {
    it('для нашего coop → registry.deactivate', async () => {
      const h = buildHarness();
      await h.watcher.handle({
        kind: 'subscription-expired',
        coopname: 'voskhod',
        packageId: PACKAGE_ID,
        blockNum: 400,
      });
      expect(h.registry.deactivated).toEqual([PACKAGE_ID]);
    });

    it('для чужого coop → ignore', async () => {
      const h = buildHarness();
      await h.watcher.handle({
        kind: 'subscription-expired',
        coopname: 'alpha',
        packageId: PACKAGE_ID,
        blockNum: 401,
      });
      expect(h.registry.deactivated).toEqual([]);
    });
  });

  describe('frontend-cache (E12-2)', () => {
    it('subscription-activated → syncPackage даже для frontend-only пакета (metadata=null)', async () => {
      const h = buildHarness();
      // metadata пуст: fetchInstallSpec вернёт null — backend не ставится,
      // но фронт-часть всё равно кэшируется.
      await h.watcher.handle({
        kind: 'subscription-activated',
        coopname: 'voskhod',
        packageId: PACKAGE_ID,
        expiresAtUnix: 1_800_000_000,
        blockNum: 500,
      });
      expect(h.frontendCache.synced).toEqual([PACKAGE_ID]);
      expect(h.orchestrator.calls).toEqual([]);
    });

    it('subscription-activated чужого coop → фронт не трогаем', async () => {
      const h = buildHarness();
      await h.watcher.handle({
        kind: 'subscription-activated',
        coopname: 'alpha',
        packageId: PACKAGE_ID,
        expiresAtUnix: 1_800_000_000,
        blockNum: 501,
      });
      expect(h.frontendCache.synced).toEqual([]);
    });

    it('subscription-expired нашего coop → evict', async () => {
      const h = buildHarness();
      await h.watcher.handle({
        kind: 'subscription-expired',
        coopname: 'voskhod',
        packageId: PACKAGE_ID,
        blockNum: 502,
      });
      expect(h.frontendCache.evicted).toEqual([PACKAGE_ID]);
    });

    it('release-published: syncPackage только если фронт уже в кэше', async () => {
      const h = buildHarness();
      h.metadata.setSpec(PACKAGE_ID, VERSION, SPEC);
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: VERSION,
        scopeType: 'all',
        blockNum: 503,
      });
      expect(h.frontendCache.synced).toEqual([]);

      h.frontendCache.cachedIds.add(PACKAGE_ID);
      await h.watcher.handle({
        kind: 'release-published',
        packageId: PACKAGE_ID,
        version: '1.1.0',
        scopeType: 'all',
        blockNum: 504,
      });
      expect(h.frontendCache.synced).toEqual([PACKAGE_ID]);
    });

    it('release-withdrawn: syncPackage для закэшированного (сам решит refresh vs evict)', async () => {
      const h = buildHarness();
      h.frontendCache.cachedIds.add(PACKAGE_ID);
      await h.watcher.handle({
        kind: 'release-withdrawn',
        packageId: PACKAGE_ID,
        version: VERSION,
        blockNum: 505,
      });
      expect(h.frontendCache.synced).toEqual([PACKAGE_ID]);
      expect(h.registry.deactivated).toEqual([PACKAGE_ID]);
    });
  });
});
