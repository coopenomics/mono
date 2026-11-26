/**
 * @fileoverview Сценарий установки subgraph-расширения (Story 10.4).
 *
 * Шаги pipeline'а:
 *  1. (опционально) issue OCI token у catalog-delivery и docker pull образа;
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
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';
import {
  APP_GRANTS,
  AppGrantsPort,
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
   * Per-package JWT от catalog-delivery для docker pull. Нужен только
   * если задан `imageRef`.
   */
  cooperativeJwt?: string;
  /**
   * Имя кооператива — username для docker login (catalog-delivery ожидает
   * совпадение с `sub`-claim'ом JWT). Нужен только если задан `imageRef`.
   */
  coopname?: string;
  /**
   * URL healthcheck'а. Если не задан — выводится из `url`:
   * origin субграфа + `/_health` (канон @coopenomics/extension-sdk).
   */
  healthUrl?: string;
  /** Healthcheck timeout. По умолчанию 60 сек — Nest-приложение успевает прогреться. */
  healthcheckTimeoutMs?: number;
  /**
   * Имя контейнера для прямого `docker run` — альтернатива compose-пути,
   * когда extension-сервис не описан заранее в compose-файле (auto-install
   * watcher'ом). Требует `imageRef`.
   */
  containerName?: string;
  /** Docker-сеть контейнера расширения (DNS-видимость для gateway/coopback). */
  containerNetwork?: string;
  /** Env контейнера расширения (SUBGRAPH_PORT, COOPNAME). */
  containerEnv?: Record<string, string>;
  /**
   * Заявка приложения на порты ядра из манифеста пакета
   * (`coopenomics.ports`, `coopenomics.chainActions`). По ней ядро выдаёт
   * токен приложения — он идёт в окружение контейнера.
   */
  corePorts?: { ports: string[]; chainActions: string[] };
}

/**
 * Пределы памяти и процессора контейнера приложения. По умолчанию их нет
 * (решение владельца 26.11.2026): потребление настоящих приложений ещё не
 * замерено, а предел наугад убивал бы приложение, которому его мало. Узел
 * задаёт предел переменными, когда замер есть. Для ориентира:
 * `@voskhod/exampleapp` — 36–56 МБ в покое, 85 МБ под нагрузкой.
 */
function limitFromEnv(name: string): number | undefined {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * `GET <subgraph-origin>/_health` — канонический healthcheck расширения
 * (HealthController в extension-sdk). GraphQL-endpoint для GET-probe
 * не годится: Apollo отвечает 400/405 на GET без query.
 */
export function deriveHealthUrl(subgraphUrl: string): string {
  try {
    return `${new URL(subgraphUrl).origin}/_health`;
  } catch {
    return subgraphUrl;
  }
}

/** Кооператив этого узла из окружения оркестратора; пусто — узел не назван. */
function nodeCoopname(): string {
  return process.env.COOPNAME ?? '';
}

/**
 * Имя контейнера расширения по пакету каталога и кооперативу узла:
 * `@voskhod/exampleapp` на узле `partner1` → `ext-partner1-exampleapp`. Одна
 * функция на установку и снятие: снятие обязано найти ровно тот контейнер,
 * который поставила установка.
 *
 * Кооператив в имени — с 26.11.2026: имя контейнера одно на весь docker
 * машины, и два узла на одной машине (связка стендов, CI) с именем
 * `ext-exampleapp` отбирали контейнер друг у друга. Без названного
 * кооператива имя прежнее — `ext-<пакет>`.
 */
export function extensionContainerName(packageId: string, coopname: string = nodeCoopname()): string {
  const name = packageId.includes('/') ? packageId.slice(packageId.indexOf('/') + 1) : packageId;
  const owner = coopname.length > 0 ? `${coopname}-` : '';
  return `ext-${owner}${name}`.replace(/[^a-zA-Z0-9_.-]/g, '-');
}

/**
 * Метка контейнера приложения каталога, значение — пакет (`@scope/name`).
 * По ней оркестратор после перезапуска узнаёт, какие приложения стоят на
 * узле, и снимает те, у которых подписки больше нет.
 */
export const EXTENSION_PACKAGE_LABEL = 'coop.extension.package';

/**
 * Метка контейнера приложения: кооператив узла, который его поставил. По ней
 * оркестратор видит только свои контейнеры, когда на машине несколько узлов.
 */
export const EXTENSION_COOP_LABEL = 'coop.extension.coopname';

/** Метки своего узла для отбора контейнеров; узел не назван — без отбора. */
function ownContainers(): Record<string, string> | undefined {
  const coopname = nodeCoopname();
  return coopname.length > 0 ? { [EXTENSION_COOP_LABEL]: coopname } : undefined;
}

export type InstallOutcome =
  | {
      status: 'applied';
      packageId: string;
      healthAfterMs: number;
      /** Контейнер создан заново (первая установка или новая версия): шлюз пересобирает схему. */
      containerReplaced?: boolean;
    }
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
    @Optional() @Inject(APP_GRANTS) private readonly grants?: AppGrantsPort,
  ) {}

  async install(input: InstallExtensionInput): Promise<InstallOutcome> {
    const timeoutMs = input.healthcheckTimeoutMs ?? 60_000;
    this.logger.log(`install start: ${input.packageId}@${input.version} → ${input.url}`);

    // 1. (опц.) docker pull: preflight-обмен JWT на OCI token (валидация
    //    подписки/scope с внятной ошибкой), затем docker login+pull тем же JWT.
    if (input.imageRef !== undefined) {
      if (input.cooperativeJwt === undefined || input.coopname === undefined) {
        return this.failed(
          input.packageId,
          'oci-token',
          'cooperativeJwt и coopname обязательны при заданном imageRef',
        );
      }
      try {
        await this.oci.issueToken({
          packageId: input.packageId,
          coopname: input.coopname,
          jwt: input.cooperativeJwt,
        });
        await this.docker.pullImage({
          imageRef: input.imageRef,
          username: input.coopname,
          password: input.cooperativeJwt,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const reason: InstallFailureReason = msg.includes('docker') ? 'docker-pull' : 'oci-token';
        return this.failed(input.packageId, reason, msg);
      }
    }

    let containerReplaced = false;
    // 2. (опц.) запуск контейнера: compose-сервис, если описан заранее,
    //    иначе прямой docker run по containerName (путь auto-install'а).
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
    } else if (input.containerName !== undefined && input.imageRef !== undefined) {
      try {
        // Контейнер уже работает на этом образе — не трогаем его. Установку
        // вызывает и первый опрос после перезапуска оркестратора: без этой
        // проверки каждый его перезапуск пересоздавал все приложения узла,
        // и они теряли состояние в памяти и простаивали (25.11.2026).
        const state = await this.docker.containerState(input.containerName);
        containerReplaced = !(state?.running === true && state.imageRef === input.imageRef);
        if (!containerReplaced) {
          this.logger.log(`контейнер ${input.containerName} уже работает на ${input.imageRef} — оставляем`);
        } else {
          // Заявка заводится только вместе с новым контейнером: повторная
          // выдача заменяет токен, а работающий контейнер держит прежний.
          const env = { ...(input.containerEnv ?? {}) };
          if (this.grants !== undefined) {
            env.CORE_PORTS_URL = this.grants.coreUrl;
            env.CORE_PORTS_TOKEN = await this.grants.issue({
              packageId: input.packageId,
              ports: input.corePorts?.ports ?? [],
              chainActions: input.corePorts?.chainActions ?? [],
            });
          }
          await this.docker.runContainer({
            imageRef: input.imageRef,
            name: input.containerName,
            network: input.containerNetwork,
            env,
            labels: { [EXTENSION_PACKAGE_LABEL]: input.packageId, ...(ownContainers() ?? {}) },
            memoryMb: limitFromEnv('EXTENSION_MEMORY_MB'),
            cpus: limitFromEnv('EXTENSION_CPUS'),
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return this.failed(input.packageId, 'compose-up', msg);
      }
    }

    // 3. healthcheck poll по /_health subgraph'а (не по GraphQL-endpoint'у).
    const healthUrl = input.healthUrl ?? deriveHealthUrl(input.url);
    const health = await this.health.waitUntilHealthy({ url: healthUrl, timeoutMs });
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
    return { status: 'applied', packageId: input.packageId, healthAfterMs: health.elapsedMs, containerReplaced };
  }

  /**
   * Снять расширение с узла: запись реестра выключается (шлюз убирает его
   * схему), контейнер останавливается и удаляется. До 25.11.2026 снятие
   * только выключало запись — контейнер отписавшегося приложения работал
   * дальше и держал память узла.
   */
  async uninstall(packageId: string): Promise<void> {
    await this.registry.deactivate(packageId);
    const container = extensionContainerName(packageId);
    await this.docker.removeContainer(container);
    // Заявка стирается после контейнера: токен приложения больше не действует.
    await this.grants?.revoke(packageId);
    this.logger.log(`uninstall: ${packageId} — запись выключена, контейнер ${container} снят`);
  }

  /** Пакеты, чьи контейнеры стоят на узле (по метке {@link EXTENSION_PACKAGE_LABEL}). */
  installedPackages(): Promise<string[]> {
    return this.docker.listLabelValues(EXTENSION_PACKAGE_LABEL, { having: ownContainers() });
  }

  /**
   * Пакеты, чей контейнер сейчас работает либо перезапускается docker'ом.
   * По этому списку опрос каталога замечает контейнер, который остановили
   * или удалили мимо оркестратора.
   */
  runningPackages(): Promise<string[]> {
    return this.docker.listLabelValues(EXTENSION_PACKAGE_LABEL, { runningOnly: true, having: ownContainers() });
  }

  private async rollbackComposeIfAny(input: InstallExtensionInput): Promise<void> {
    try {
      if (input.composeService !== undefined && input.composeFile !== undefined) {
        await this.docker.composeDown({
          composeFile: input.composeFile,
          serviceName: input.composeService,
        });
      } else if (input.containerName !== undefined && input.imageRef !== undefined) {
        await this.docker.removeContainer(input.containerName);
      }
    } catch (e) {
      this.logger.error(
        `rollback failed for ${input.packageId}: ${e instanceof Error ? e.message : String(e)}`,
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
