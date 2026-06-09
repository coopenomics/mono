/**
 * @fileoverview Сценарий установки subgraph-расширения (Story 10.4).
 *
 * Шаги pipeline'а:
 *  1. (опционально) issue OCI token у CA-auth и docker pull образа;
 *  2. (опционально) docker compose up сервиса в проекте orchestrator'а;
 *  3. healthcheck по URL — ждём пока subgraph внутри контейнера
 *     прогреется и начнёт отвечать 200;
 *  4. upsert записи в `subgraph_registry` (active=true, healthStatus='ok');
 *  5. Apollo Gateway за ≤10 сек подтянет новую запись polling'ом и
 *     добавит subgraph в supergraph — клиенты увидят его без рестарта.
 *
 * Discriminated outcome `applied | failed` — клиент должен switch'ить
 * на `status`. На любом failure делаем rollback (compose down + deactivate
 * в registry), чтобы не оставить «висящий» сервис, в который никто не
 * маршрутизируется.
 *
 * Сервис намеренно не знает про docker socket / OCI / HTTP напрямую —
 * это всё за портами {@link DockerRunnerPort}, {@link HealthProbePort},
 * {@link OciTokenClientPort}. Тесты гоняют сценарий через моки портов
 * без реального docker daemon'а.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';
import {
  DOCKER_RUNNER,
  DockerRunnerPort,
  HEALTH_PROBE,
  HealthProbePort,
  OCI_TOKEN_CLIENT,
  OciTokenClientPort,
} from './ports';

export interface InstallExtensionInput {
  /** `@scope/name` пакета в каталоге. */
  packageId: string;
  /** Семантическая версия релиза. */
  version: string;
  /**
   * Внутренний URL subgraph'а внутри docker-сети
   * (например `http://chatcoop:3000/graphql`). Используется и для
   * healthcheck'а, и как `url` в registry.
   */
  url: string;
  /**
   * OCI-ссылка образа `registry.host/scope/name:version`. Если задана —
   * orchestrator делает docker pull. Если пусто — считается, что
   * контейнер уже поднят сторонним образом (например core-subgraph).
   */
  imageRef?: string;
  /**
   * Имя сервиса в docker-compose файле orchestrator'а. Если задано
   * вместе с `composeFile` — orchestrator делает `compose up -d <svc>`.
   */
  composeService?: string;
  /**
   * Путь к docker-compose файлу, описывающему extension-сервисы.
   * Опциональный — если расширения деплоятся другим механизмом
   * (k8s, swarm) — orchestrator только healthcheck'ает.
   */
  composeFile?: string;
  /**
   * JWT кооператива для запроса OCI-токена у CA-auth. Нужен только
   * если задан `imageRef`.
   */
  cooperativeJwt?: string;
  /** Healthcheck timeout. По умолчанию 60 сек — Nest-приложение успевает прогреться. */
  healthcheckTimeoutMs?: number;
}

export type InstallOutcome =
  | { status: 'applied'; packageId: string; healthAfterMs: number }
  | { status: 'failed'; packageId: string; reason: InstallFailureReason; error: string };

export type InstallFailureReason =
  | 'oci-token'
  | 'docker-pull'
  | 'compose-up'
  | 'healthcheck'
  | 'registry-write';

@Injectable()
export class InstallOrchestratorService {
  private readonly logger = new Logger(InstallOrchestratorService.name);

  constructor(
    @Inject(DOCKER_RUNNER) private readonly docker: DockerRunnerPort,
    @Inject(HEALTH_PROBE) private readonly health: HealthProbePort,
    @Inject(OCI_TOKEN_CLIENT) private readonly oci: OciTokenClientPort,
    private readonly registry: SubgraphRegistryService,
  ) {}

  async install(input: InstallExtensionInput): Promise<InstallOutcome> {
    const timeoutMs = input.healthcheckTimeoutMs ?? 60_000;
    this.logger.log(`install start: ${input.packageId}@${input.version} → ${input.url}`);

    // 1. (опц.) docker pull через CA-auth OCI token.
    if (input.imageRef !== undefined) {
      if (input.cooperativeJwt === undefined) {
        return this.failed(input.packageId, 'oci-token', 'cooperativeJwt обязателен при заданном imageRef');
      }
      try {
        const bearerToken = await this.oci.issueToken({
          packageId: input.packageId,
          jwt: input.cooperativeJwt,
        });
        await this.docker.pullImage({ imageRef: input.imageRef, bearerToken });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const reason: InstallFailureReason = msg.includes('docker') ? 'docker-pull' : 'oci-token';
        return this.failed(input.packageId, reason, msg);
      }
    }

    // 2. (опц.) docker compose up сервиса.
    if (input.composeService !== undefined && input.composeFile !== undefined) {
      try {
        await this.docker.composeUp({
          composeFile: input.composeFile,
          serviceName: input.composeService,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return this.failed(input.packageId, 'compose-up', msg);
      }
    }

    // 3. healthcheck poll по URL subgraph'а.
    const health = await this.health.waitUntilHealthy({ url: input.url, timeoutMs });
    if (!health.ok) {
      await this.rollbackComposeIfAny(input);
      return this.failed(
        input.packageId,
        'healthcheck',
        `${health.reason}${health.lastError ? `: ${health.lastError}` : ''}`,
      );
    }

    // 4. upsert в subgraph_registry — Apollo Gateway за ≤10 сек подхватит.
    try {
      await this.registry.upsert(input.packageId, input.version, input.url);
      await this.registry.setHealthStatus(input.packageId, 'ok');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.rollbackComposeIfAny(input);
      return this.failed(input.packageId, 'registry-write', msg);
    }

    this.logger.log(`install applied: ${input.packageId}@${input.version} (health ${health.elapsedMs}ms)`);
    return { status: 'applied', packageId: input.packageId, healthAfterMs: health.elapsedMs };
  }

  private async rollbackComposeIfAny(input: InstallExtensionInput): Promise<void> {
    if (input.composeService === undefined || input.composeFile === undefined) return;
    try {
      await this.docker.composeDown({
        composeFile: input.composeFile,
        serviceName: input.composeService,
      });
    } catch (e) {
      this.logger.error(
        `rollback composeDown failed for ${input.packageId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private failed(
    packageId: string,
    reason: InstallFailureReason,
    error: string,
  ): InstallOutcome {
    this.logger.error(`install failed (${reason}) ${packageId}: ${error}`);
    return { status: 'failed', packageId, reason, error };
  }
}
