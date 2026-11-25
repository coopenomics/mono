/**
 * Стандартный набор env-переменных расширения.
 *
 * SUBGRAPH_PORT     — порт, на котором subgraph слушает (например 3001)
 * JWT_SECRET        — общий секрет с core'ом для валидации JWT
 * COOPNAME          — account name кооператива-tenant'а
 * DATABASE_URL      — connection string Postgres tenant'а (опц.)
 * CORE_GRAPHQL_URL  — endpoint core subgraph'а для inter-extension fetch (опц.)
 *
 * Расширение читает их через `loadExtensionConfig()` на bootstrap; падает
 * сразу же если обязательное поле не задано — fail-fast, чтобы orchestrator
 * увидел unhealthy и не зарегистрировал subgraph.
 */
export interface ExtensionConfig {
  subgraphPort: number;
  /**
   * Секрет подписи токенов ядра. Оставлен для приложений, собранных до входа
   * портов; новому приложению секрет не передаётся — пайщика проверяет ядро
   * (`ExtensionAccessGuard`).
   */
  jwtSecret?: string;
  /** Адрес ядра для вызова портов (`CORE_PORTS_URL`). */
  corePortsUrl?: string;
  /** Токен приложения для вызова портов ядра (`CORE_PORTS_TOKEN`). */
  corePortsToken?: string;
  coopname: string;
  databaseUrl?: string;
  coreGraphqlUrl?: string;
}

export class ExtensionConfigError extends Error {
  constructor(message: string) {
    super(`[extension-sdk] ${message}`);
    this.name = 'ExtensionConfigError';
  }
}

export function loadExtensionConfig(env: NodeJS.ProcessEnv = process.env): ExtensionConfig {
  const port = Number(env.SUBGRAPH_PORT);
  if (!Number.isFinite(port) || port <= 0) {
    throw new ExtensionConfigError('SUBGRAPH_PORT не задан или некорректен');
  }
  const jwtSecret = env.JWT_SECRET || undefined;
  const corePortsUrl = env.CORE_PORTS_URL || undefined;
  const corePortsToken = env.CORE_PORTS_TOKEN || undefined;
  // Доступ к ядру здесь не требуется: приложению без портов и без защищённых
  // запросов он ни к чему. Приложение, которому порты ядра обязательны,
  // проверяет corePortsUrl и corePortsToken само при старте.
  const coopname = env.COOPNAME;
  if (!coopname) {
    throw new ExtensionConfigError('COOPNAME не задан');
  }
  return {
    subgraphPort: port,
    jwtSecret,
    corePortsUrl,
    corePortsToken,
    coopname,
    databaseUrl: env.DATABASE_URL,
    coreGraphqlUrl: env.CORE_GRAPHQL_URL,
  };
}
