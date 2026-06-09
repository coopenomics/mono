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
  pulls: Array<{ imageRef: string; bearerToken: string }> = [];
  ups: Array<{ composeFile: string; serviceName: string }> = [];
  downs: Array<{ composeFile: string; serviceName: string }> = [];
  pullError?: Error;
  upError?: Error;
  async pullImage(opts: { imageRef: string; bearerToken: string }): Promise<void> {
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
  calls: Array<{ packageId: string; jwt: string }> = [];
  token = 'fake-bearer-token';
  error?: Error;
  async issueToken(opts: { packageId: string; jwt: string }): Promise<string> {
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
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return; // narrowing
    expect(result.packageId).toBe(baseInput.packageId);
    expect(result.healthAfterMs).toBe(100);

    expect(h.oci.calls).toEqual([{ packageId: baseInput.packageId, jwt: 'jwt-of-voskhod' }]);
    expect(h.docker.pulls).toEqual([
      { imageRef: 'registry.local/coopenomics/chatcoop:1.0.0', bearerToken: 'fake-bearer-token' },
    ]);
    expect(h.docker.ups).toEqual([
      { composeFile: '/etc/orchestrator/extensions.yaml', serviceName: 'chatcoop' },
    ]);
    expect(h.health.calls).toEqual([
      { url: baseInput.url, timeoutMs: 60_000 },
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

  it('imageRef без cooperativeJwt → failed: oci-token, без shell-вызовов', async () => {
    const h = buildHarness();
    const result = await h.service.install({ ...baseInput, imageRef: 'reg/img:1.0.0' });
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
      imageRef: 'reg/img:1.0.0',
      cooperativeJwt: 'jwt',
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
    expect(h.health.calls).toEqual([{ url: baseInput.url, timeoutMs: 5_000 }]);
  });
});
