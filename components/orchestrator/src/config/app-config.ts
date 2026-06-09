/**
 * ENV-конфигурация orchestrator (per-tenant).
 *
 * Все обязательные поля fail-fast валидируются на bootstrap. Если orchestrator
 * стартует и не находит coopback subgraph URL — он не сможет ничего
 * скомпоновать; полагаться на default'ы для tenant'а опасно.
 */
export interface AppConfig {
  port: number;
  postgresUrl: string;
  coreSubgraphUrl: string;
  coopname: string;
  jwtSecret: string;
  compositionPollIntervalMs: number;
}

export class AppConfigError extends Error {
  constructor(msg: string) {
    super(`[orchestrator] ${msg}`);
    this.name = 'AppConfigError';
  }
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.GATEWAY_PORT ?? 4000);
  if (!Number.isFinite(port) || port <= 0) {
    throw new AppConfigError('GATEWAY_PORT некорректен');
  }
  const postgresUrl = env.DATABASE_URL;
  if (!postgresUrl) {
    throw new AppConfigError('DATABASE_URL не задан');
  }
  const coreSubgraphUrl = env.CORE_SUBGRAPH_URL;
  if (!coreSubgraphUrl) {
    throw new AppConfigError('CORE_SUBGRAPH_URL не задан (например http://coopback:3000/v1/graphql)');
  }
  const coopname = env.COOPNAME;
  if (!coopname) {
    throw new AppConfigError('COOPNAME не задан');
  }
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppConfigError('JWT_SECRET не задан');
  }
  return {
    port,
    postgresUrl,
    coreSubgraphUrl,
    coopname,
    jwtSecret,
    compositionPollIntervalMs: Number(env.COMPOSITION_POLL_INTERVAL_MS ?? 10000),
  };
}
