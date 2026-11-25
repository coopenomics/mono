/**
 * @fileoverview Юнит-тесты install-pipeline'а. Все внешние зависимости
 * (docker/health/OCI) подменены ин-мемори моками; SubgraphRegistryService
 * подменяется fake'ом с in-memory map'ой.
 *
 * Что покрываем (Story 10.4):
 *  1. happy path с imageRef: OCI token → docker pull → compose up → healthy → registry.
 *  2. happy path без imageRef (core-subgraph-style): только healthcheck + registry.
 *  3. healthcheck timeout → failed + rollback composeDown.
 *  4. OCI token error без jwt → failed без shell-вызовов.
 *  5. docker pull error → failed на этапе docker-pull.
 *  6. registry write error → failed + rollback composeDown.
 */
import {
  extensionContainerName,
  InstallOrchestratorService,
  InstallExtensionInput,
} from './install-orchestrator.service';
import {
  DockerRunnerPort,
  HealthOutcome,
  HealthProbePort,
  OciTokenClientPort,
} from './ports';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';

class FakeDockerRunner implements DockerRunnerPort {
  pulls: Array<{ imageRef: string; username: string; password: string }> = [];
  ups: Array<{ composeFile: string; serviceName: string }> = [];
  downs: Array<{ composeFile: string; serviceName: string }> = [];
  pullError?: Error;
  upError?: Error;
  async pullImage(opts: { imageRef: string; username: string; password: string }): Promise<void> {
    this.pulls.push(opts);
    if (this.pullError) throw this.pullError;
  }
  async composeUp(opts: { composeFile: string; serviceName: string }): Promise<void> {
    this.ups.push(opts);
    if (this.upError) throw this.upError;
  }
  async composeDown(opts: { composeFile: string; serviceName: string }): Promise<void> {
    this.downs.push(opts);
  }
  runs: Array<{
    imageRef: string;
    name: string;
    network?: string;
    env?: Record<string, string>;
    labels?: Record<string, string>;
  }> = [];
  removed: string[] = [];
  runError?: Error;
  /** Что «уже стоит» на узле: имя контейнера → состояние. */
  states = new Map<string, { running: boolean; imageRef: string }>();
  labelValues: string[] = [];
  async runContainer(opts: {
    imageRef: string;
    name: string;
    network?: string;
    env?: Record<string, string>;
    labels?: Record<string, string>;
  }): Promise<void> {
    this.runs.push(opts);
    if (this.runError) throw this.runError;
  }
  async removeContainer(name: string): Promise<void> {
    this.removed.push(name);
  }
  async containerState(name: string): Promise<{ running: boolean; imageRef: string } | null> {
    return this.states.get(name) ?? null;
  }
  async listLabelValues(): Promise<string[]> {
    return this.labelValues;
  }
}

class FakeHealthProbe implements HealthProbePort {
  outcome: HealthOutcome = { ok: true, elapsedMs: 100 };
  calls: Array<{ url: string; timeoutMs: number }> = [];
  async waitUntilHealthy(opts: { url: string; timeoutMs: number }): Promise<HealthOutcome> {
    this.calls.push(opts);
    return this.outcome;
  }
}

class FakeOciTokenClient implements OciTokenClientPort {
  calls: Array<{ packageId: string; coopname: string; jwt: string }> = [];
  token = 'fake-bearer-token';
  error?: Error;
  async issueToken(opts: { packageId: string; coopname: string; jwt: string }): Promise<string> {
    this.calls.push(opts);
    if (this.error) throw this.error;
    return this.token;
  }
}

class FakeRegistryService {
  upserts: Array<{ packageId: string; version: string; url: string }> = [];
  healthSets: Array<{ packageId: string; healthStatus: string }> = [];
  upsertError?: Error;
  async upsert(packageId: string, version: string, url: string): Promise<void> {
    this.upserts.push({ packageId, version, url });
    if (this.upsertError) throw this.upsertError;
  }
  async setHealthStatus(packageId: string, healthStatus: string): Promise<void> {
    this.healthSets.push({ packageId, healthStatus });
  }
  deactivated: string[] = [];
  async deactivate(packageId: string): Promise<void> {
    this.deactivated.push(packageId);
  }
}

const buildHarness = (): {
  service: InstallOrchestratorService;
  docker: FakeDockerRunner;
  health: FakeHealthProbe;
  oci: FakeOciTokenClient;
  registry: FakeRegistryService;
} => {
  const docker = new FakeDockerRunner();
  const health = new FakeHealthProbe();
  const oci = new FakeOciTokenClient();
  const registry = new FakeRegistryService();
  const service = new InstallOrchestratorService(
    docker,
    health,
    oci,
    registry as unknown as SubgraphRegistryService,
  );
  return { service, docker, health, oci, registry };
};

const baseInput: InstallExtensionInput = {
  packageId: '@coopenomics/chatcoop',
  version: '1.0.0',
  url: 'http://chatcoop:3000/graphql',
};

describe('InstallOrchestratorService', () => {
  it('happy path c imageRef: OCI → pull → up → healthy → registry', async () => {
    const h = buildHarness();
    const result = await h.service.install({
      ...baseInput,
      imageRef: 'registry.local/coopenomics/chatcoop:1.0.0',
      composeFile: '/etc/orchestrator/extensions.yaml',
      composeService: 'chatcoop',
      cooperativeJwt: 'jwt-of-voskhod',
      coopname: 'voskhod',
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return; // narrowing
    expect(result.packageId).toBe(baseInput.packageId);
    expect(result.healthAfterMs).toBe(100);

    expect(h.oci.calls).toEqual([
      { packageId: baseInput.packageId, coopname: 'voskhod', jwt: 'jwt-of-voskhod' },
    ]);
    expect(h.docker.pulls).toEqual([
      {
        imageRef: 'registry.local/coopenomics/chatcoop:1.0.0',
        username: 'voskhod',
        password: 'jwt-of-voskhod',
      },
    ]);
    expect(h.docker.ups).toEqual([
      { composeFile: '/etc/orchestrator/extensions.yaml', serviceName: 'chatcoop' },
    ]);
    expect(h.health.calls).toEqual([
      { url: 'http://chatcoop:3000/_health', timeoutMs: 60_000 },
    ]);
    expect(h.registry.upserts).toEqual([
      { packageId: baseInput.packageId, version: baseInput.version, url: baseInput.url },
    ]);
    expect(h.registry.healthSets).toEqual([
      { packageId: baseInput.packageId, healthStatus: 'ok' },
    ]);
    expect(h.docker.downs).toEqual([]);
  });

  it('happy path без imageRef — только healthcheck и registry (core-style)', async () => {
    const h = buildHarness();
    const result = await h.service.install(baseInput);
    expect(result.status).toBe('applied');
    expect(h.oci.calls).toEqual([]);
    expect(h.docker.pulls).toEqual([]);
    expect(h.docker.ups).toEqual([]);
    expect(h.health.calls.length).toBe(1);
    expect(h.registry.upserts.length).toBe(1);
  });

  it('healthcheck timeout → failed + rollback composeDown', async () => {
    const h = buildHarness();
    h.health.outcome = { ok: false, reason: 'timeout', lastError: 'no response' };
    const result = await h.service.install({
      ...baseInput,
      composeFile: '/etc/orchestrator/extensions.yaml',
      composeService: 'chatcoop',
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.reason).toBe('healthcheck');
    expect(result.error).toContain('timeout');
    expect(h.docker.downs).toEqual([
      { composeFile: '/etc/orchestrator/extensions.yaml', serviceName: 'chatcoop' },
    ]);
    expect(h.registry.upserts).toEqual([]);
  });

  it('imageRef без cooperativeJwt/coopname → failed: oci-token, без shell-вызовов', async () => {
    const h = buildHarness();
    const result = await h.service.install({ ...baseInput, imageRef: 'reg.local/img:1.0.0' });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.reason).toBe('oci-token');
    expect(h.oci.calls).toEqual([]);
    expect(h.docker.pulls).toEqual([]);
  });

  it('docker pull error → failed: docker-pull', async () => {
    const h = buildHarness();
    h.docker.pullError = new Error('docker pull failed: unauthorized');
    const result = await h.service.install({
      ...baseInput,
      imageRef: 'reg.local/img:1.0.0',
      cooperativeJwt: 'jwt',
      coopname: 'voskhod',
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.reason).toBe('docker-pull');
    expect(result.error).toContain('docker pull failed');
    expect(h.health.calls).toEqual([]);
    expect(h.registry.upserts).toEqual([]);
  });

  it('registry upsert error → failed: registry-write + rollback composeDown', async () => {
    const h = buildHarness();
    h.registry.upsertError = new Error('postgres unavailable');
    const result = await h.service.install({
      ...baseInput,
      composeFile: '/etc/orchestrator/extensions.yaml',
      composeService: 'chatcoop',
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.reason).toBe('registry-write');
    expect(h.docker.downs).toEqual([
      { composeFile: '/etc/orchestrator/extensions.yaml', serviceName: 'chatcoop' },
    ]);
  });

  it('healthcheckTimeoutMs из input пробрасывается в HealthProbe', async () => {
    const h = buildHarness();
    await h.service.install({ ...baseInput, healthcheckTimeoutMs: 5_000 });
    expect(h.health.calls).toEqual([{ url: 'http://chatcoop:3000/_health', timeoutMs: 5_000 }]);
  });

  it('containerName без compose → docker run + rollback removeContainer при provале healthcheck', async () => {
    const h = buildHarness();
    const input = {
      ...baseInput,
      imageRef: 'registry.local/coopenomics/chatcoop:1.0.0',
      cooperativeJwt: 'jwt-of-voskhod',
      coopname: 'voskhod',
      containerName: 'ext-chatcoop',
      containerNetwork: 'mono-net',
      containerEnv: { SUBGRAPH_PORT: '3001' },
    };
    const ok = await h.service.install(input);
    expect(ok.status).toBe('applied');
    expect(h.docker.runs).toEqual([
      {
        imageRef: input.imageRef,
        name: 'ext-chatcoop',
        network: 'mono-net',
        env: { SUBGRAPH_PORT: '3001' },
        labels: { 'coop.extension.package': '@coopenomics/chatcoop' },
      },
    ]);

    const h2 = buildHarness();
    h2.health.outcome = { ok: false, reason: 'timeout' };
    const failed = await h2.service.install(input);
    expect(failed.status).toBe('failed');
    expect(h2.docker.removed).toEqual(['ext-chatcoop']);
  });

  // Установку вызывает и первый опрос после перезапуска оркестратора. До
  // 25.11.2026 каждый его перезапуск пересоздавал контейнеры всех приложений
  // узла: они простаивали и теряли состояние в памяти.
  describe('контейнер приложения уже стоит на узле', () => {
    const input = {
      ...baseInput,
      imageRef: 'registry.local/coopenomics/chatcoop:1.0.0',
      cooperativeJwt: 'jwt-of-voskhod',
      coopname: 'voskhod',
      containerName: 'ext-chatcoop',
    };

    it('break: работает на том же образе → docker run не зовётся, здоровье и реестр проверяются', async () => {
      const h = buildHarness();
      h.docker.states.set('ext-chatcoop', { running: true, imageRef: input.imageRef });
      const result = await h.service.install(input);
      expect(result.status).toBe('applied');
      expect(h.docker.runs).toEqual([]);
      expect(h.docker.removed).toEqual([]);
      expect(h.health.calls).toHaveLength(1);
      expect(h.registry.upserts).toHaveLength(1);
    });

    it('side: работает на другом образе (вышла новая версия) → контейнер заменяется', async () => {
      const h = buildHarness();
      h.docker.states.set('ext-chatcoop', { running: true, imageRef: 'registry.local/coopenomics/chatcoop:0.9.0' });
      await h.service.install(input);
      expect(h.docker.runs.map((r) => r.imageRef)).toEqual([input.imageRef]);
    });

    it('side: контейнер есть, но остановлен → запускается заново', async () => {
      const h = buildHarness();
      h.docker.states.set('ext-chatcoop', { running: false, imageRef: input.imageRef });
      await h.service.install(input);
      expect(h.docker.runs).toHaveLength(1);
    });
  });

  // До 25.11.2026 снятие только выключало запись реестра: контейнер
  // отписавшегося приложения работал дальше и держал память узла.
  describe('uninstall', () => {
    it('happy: запись реестра выключена, контейнер пакета снят', async () => {
      const h = buildHarness();
      await h.service.uninstall('@voskhod/exampleapp');
      expect(h.registry.deactivated).toEqual(['@voskhod/exampleapp']);
      expect(h.docker.removed).toEqual(['ext-exampleapp']);
    });

    it('side: имя контейнера при снятии совпадает с именем при установке', () => {
      expect(extensionContainerName('@voskhod/exampleapp')).toBe('ext-exampleapp');
      // Символы вне [a-zA-Z0-9_.-] заменяются дефисом: имя годится для docker.
      expect(extensionContainerName('@coop/стол заказов')).toBe(`ext-${'-'.repeat(12)}`);
      expect(extensionContainerName('plain')).toBe('ext-plain');
    });

    it('happy: installedPackages отдаёт пакеты по метке контейнеров', async () => {
      const h = buildHarness();
      h.docker.labelValues = ['@voskhod/exampleapp'];
      expect(await h.service.installedPackages()).toEqual(['@voskhod/exampleapp']);
    });
  });
});
