/**
 * @fileoverview Порты для install-pipeline'а. Сервис {@link InstallOrchestratorService}
 * зависит только от этих интерфейсов; реальные shell-out / HTTP-импленты
 * лежат рядом в `*.impl.ts` и подключаются в `OrchestratorModule`.
 *
 * Зачем интерфейсы: docker socket / сеть наружу — environment-specific.
 * Тесты подменяют порты на in-memory моки, не запуская docker. Story 10.4.
 */

/**
 * Порт обращения к docker daemon хоста. MWP-набор операций:
 * pull image (с авторизацией через OCI token) и compose up.
 *
 * Реальный impl шеллит `docker pull` / `docker compose up -d`. Тестовый
 * impl возвращает заранее заданные результаты — без shell.
 */
export interface DockerRunnerPort {
  /**
   * Подтянуть образ из приватного registry.
   *
   * `username`/`password` — credentials для `docker login` (password —
   * per-package JWT от catalog-delivery; docker сам обменяет его на Bearer через
   * OCI token endpoint `GET /v2/auth/token` по `WWW-Authenticate`-flow).
   */
  pullImage(opts: { imageRef: string; username: string; password: string }): Promise<void>;
  /** Поднять сервис compose-проекта (idempotent — повторный вызов no-op если up). */
  composeUp(opts: { composeFile: string; serviceName: string }): Promise<void>;
  /** Снять сервис compose-проекта — используется на rollback. */
  composeDown(opts: { composeFile: string; serviceName: string }): Promise<void>;
  /**
   * Прямой `docker run -d` контейнера расширения — путь auto-install'а,
   * когда extension-сервис не описан заранее в compose-файле. Idempotent:
   * существующий контейнер с тем же именем заменяется (rm -f + run) —
   * так обновление версии не требует отдельной ветки кода.
   */
  runContainer(opts: {
    imageRef: string;
    name: string;
    network?: string;
    env?: Record<string, string>;
    /** Метки контейнера: по ним оркестратор находит контейнеры приложений. */
    labels?: Record<string, string>;
    /** Предел памяти контейнера, МБ; не задан — без предела. */
    memoryMb?: number;
    /** Предел процессора контейнера, ядер; не задан — без предела. */
    cpus?: number;
  }): Promise<void>;
  /** Значения метки у всех контейнеров, где она стоит (работающих и остановленных). */
  listLabelValues(
    label: string,
    options?: { runningOnly?: boolean; /** Отбор по значениям других меток. */ having?: Record<string, string> },
  ): Promise<string[]>;
  /** Снять контейнер расширения (rollback/uninstall). Idempotent. */
  removeContainer(name: string): Promise<void>;
  /**
   * Состояние контейнера расширения: работает ли он и из какого образа
   * создан. `null` — контейнера с таким именем нет. По нему установка
   * решает, трогать ли контейнер: здоровое приложение на нужном образе
   * пересоздавать незачем.
   */
  containerState(name: string): Promise<{ running: boolean; imageRef: string } | null>;
}

export const DOCKER_RUNNER = Symbol('DockerRunnerPort');

/**
 * Заявки приложений на порты ядра (487-17). Установка заводит заявку и
 * получает токен приложения для окружения контейнера; снятие стирает заявку,
 * и ядро перестаёт принимать токен.
 */
export interface AppGrantsPort {
  /** Завести или заменить заявку пакета. Возвращает токен приложения. */
  issue(opts: { packageId: string; ports: string[]; chainActions: string[] }): Promise<string>;
  /** Стереть заявку пакета. Idempotent. */
  revoke(packageId: string): Promise<void>;
  /** Адрес ядра для вызова портов из контейнера приложения. */
  readonly coreUrl: string;
}

export const APP_GRANTS = Symbol('AppGrantsPort');

/**
 * Порт healthcheck'а subgraph'а. Делает GET к указанному URL и считает
 * сервис здоровым, если получает 200 OK с непустым body в течение
 * `timeoutMs`. Реальный impl поллит с интервалом ≤500ms; тестовый
 * отвечает заранее.
 *
 * Зачем именно poll, а не один запрос: docker compose up возвращается
 * сразу же по запуску контейнера; Nest-приложение внутри стартует
 * 1-3 секунды (DI, TypeORM connect, GraphQL schema introspection).
 * Без поллинга мы получили бы false negative.
 */
export interface HealthProbePort {
  waitUntilHealthy(opts: { url: string; timeoutMs: number }): Promise<HealthOutcome>;
}

export type HealthOutcome =
  | { ok: true; elapsedMs: number }
  | { ok: false; reason: 'timeout' | 'badStatus' | 'transportError'; lastError?: string };

export const HEALTH_PROBE = Symbol('HealthProbePort');

/**
 * Порт preflight-проверки docker pull у catalog-delivery: обмен per-package JWT
 * на OCI access_token через `GET /v2/auth/token` (Basic-auth, JWT в
 * password). Реальный pull делает `docker login` тем же JWT — этот порт
 * нужен, чтобы провалить install быстро и с внятной причиной (нет
 * подписки / scope mismatch), не дожидаясь невнятного 403 от docker CLI.
 *
 * @see catalog-delivery/src/modules/registry/web/oci-token.controller.ts (Story 10.6)
 */
export interface OciTokenClientPort {
  issueToken(opts: { packageId: string; coopname: string; jwt: string }): Promise<string>;
}

export const OCI_TOKEN_CLIENT = Symbol('OciTokenClientPort');
