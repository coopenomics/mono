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
   * per-package JWT от CA-auth; docker сам обменяет его на Bearer через
   * OCI token endpoint `GET /v2/auth/token` по `WWW-Authenticate`-flow).
   */
  pullImage(opts: { imageRef: string; username: string; password: string }): Promise<void>;
  /** Поднять сервис compose-проекта (idempotent — повторный вызов no-op если up). */
  composeUp(opts: { composeFile: string; serviceName: string }): Promise<void>;
  /** Снять сервис compose-проекта — используется на rollback. */
  composeDown(opts: { composeFile: string; serviceName: string }): Promise<void>;
}

export const DOCKER_RUNNER = Symbol('DockerRunnerPort');

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
 * Порт preflight-проверки docker pull у CA-auth: обмен per-package JWT
 * на OCI access_token через `GET /v2/auth/token` (Basic-auth, JWT в
 * password). Реальный pull делает `docker login` тем же JWT — этот порт
 * нужен, чтобы провалить install быстро и с внятной причиной (нет
 * подписки / scope mismatch), не дожидаясь невнятного 403 от docker CLI.
 *
 * @see ca-auth/src/modules/registry/web/oci-token.controller.ts (Story 10.6)
 */
export interface OciTokenClientPort {
  issueToken(opts: { packageId: string; coopname: string; jwt: string }): Promise<string>;
}

export const OCI_TOKEN_CLIENT = Symbol('OciTokenClientPort');
