/**
 * Клиент входа портов ядра (`POST /v1/internal/ports/:port/:method`).
 *
 * Приложение каталога работает в своём контейнере, и инъекции порта через
 * границу процесса нет. Клиент выполняет тот же вызов по сети: тело —
 * аргументы метода, ответ — его результат. Токен приложения выдаёт ядро при
 * установке, оркестратор кладёт его в окружение контейнера.
 */

/** Отказ ядра: его код и текст — те же, что получил бы вызов внутри ядра. */
export class CorePortError extends Error {
  constructor(
    /** HTTP-статус ответа ядра; 0 — ядро не ответило. */
    readonly status: number,
    /** Код отказа ядра (`APPS_CATALOG_PROXY_APP_PORT_NOT_GRANTED`, `DOCUMENT_NOT_FOUND`, …). */
    readonly code: string,
    message: string,
    /** Параметры отказа из ответа ядра. */
    readonly params: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CorePortError';
  }
}

export interface CorePortsClientOptions {
  /** Адрес ядра в сети узла, например `http://coopback:2998`. */
  baseUrl: string;
  /** Токен приложения (`apt_…`). */
  token: string;
  /** Предел ожидания одного вызова, мс. По умолчанию 30 с — формирование PDF небыстрое. */
  timeoutMs?: number;
  /** Подмена fetch в тестах. */
  fetchFn?: typeof fetch;
}

/**
 * Чтения, которые безопасно повторить при сбое сети. Всё остальное не
 * повторяется: `chain.transact` и `document.generate` меняют состояние, а
 * повторная транзакция в цепи хуже отказа (ADR-18, п. 4).
 */
const RETRYABLE = new Set([
  'document.getByHash',
  'document.validateSigned',
  'document.buildAggregate',
  'cooperativeVars.get',
  'accessToken.identify',
  'account.getDisplayName',
  'chain.getSingleRow',
  'chain.queryRows',
]);

const RETRY_PAUSE_MS = 300;

export class CorePortsClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: CorePortsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Вызвать метод порта ядра.
   *
   * @throws CorePortError — ядро отказало (статус и код из его ответа) либо
   *   не ответило (статус 0, код `CORE_UNREACHABLE`).
   */
  async call<T = unknown>(port: string, method: string, args: unknown[]): Promise<T> {
    const attempts = RETRYABLE.has(`${port}.${method}`) ? 2 : 1;
    let last: CorePortError | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.once<T>(port, method, args);
      } catch (e) {
        last = e instanceof CorePortError ? e : new CorePortError(0, 'CORE_UNREACHABLE', String(e));
        // Повторяется только молчание ядра и его 5xx: отказ по правам повтор не изменит.
        if (last.status !== 0 && last.status < 500) break;
        if (attempt < attempts) await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
      }
    }
    throw last as CorePortError;
  }

  private async once<T>(port: string, method: string, args: unknown[]): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/v1/internal/ports/${port}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.options.token}` },
        body: JSON.stringify({ args }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new CorePortError(0, 'CORE_UNREACHABLE', `ядро не ответило на ${port}.${method}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      throw new CorePortError(
        res.status,
        typeof body?.code === 'string' ? body.code : 'CORE_PORT_FAILED',
        typeof body?.message === 'string' ? body.message : `ядро ответило ${res.status} на ${port}.${method}`,
        body?.params && typeof body.params === 'object' ? body.params : {},
      );
    }
    return (body?.result ?? null) as T;
  }
}
