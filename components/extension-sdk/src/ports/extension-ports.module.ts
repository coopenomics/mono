import { DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import { CorePortsClient } from './core-ports.client';

/**
 * Порты ядра, доступные приложению по сети: имя порта в адресе вызова и
 * DI-токен `@coopenomics/innercoop`, под которым приложение его инжектит.
 * Токены — `Symbol.for(...)`: совпадают с токенами пакета innercoop без
 * зависимости SDK от него.
 */
export const REMOTE_PORT_TOKENS = {
  document: Symbol.for('Innercoop.CorePort.Document'),
  cooperativeVars: Symbol.for('Innercoop.CorePort.CooperativeVars'),
  accessToken: Symbol.for('Innercoop.CorePort.AccessToken'),
  account: Symbol.for('Innercoop.CorePort.Account'),
  chain: Symbol.for('Innercoop.CorePort.Chain'),
} as const;

/** Имя порта ядра, доступного по сети. */
export type RemotePortName = keyof typeof REMOTE_PORT_TOKENS;

/**
 * Методы портов, открытые ядром по сети — зеркало каталога ядра
 * (`remote-ports.catalog.ts` расширения apps). Объект порта отвечает только
 * на них: Nest, Apollo и `JSON.stringify` спрашивают у провайдера служебные
 * свойства (`then`, `toJSON`, `onModuleInit`), и сетевой вызов на каждое
 * такое обращение ронял приложение отказом ядра.
 */
export const REMOTE_PORT_METHODS: Record<RemotePortName, readonly string[]> = {
  document: ['generate', 'getByHash', 'validateSigned', 'buildAggregate'],
  cooperativeVars: ['get'],
  accessToken: ['identify'],
  account: ['getDisplayName'],
  chain: ['transact', 'getSingleRow', 'queryRows'],
};

export interface ExtensionPortsOptions {
  /** Адрес ядра (`CORE_PORTS_URL`). */
  coreUrl: string;
  /** Токен приложения (`CORE_PORTS_TOKEN`). */
  token: string;
  /**
   * Порты, которые приложение использует. Те же имена стоят в манифесте
   * пакета (`coopenomics.ports`): незаявленный порт ядро отклонит.
   */
  ports: RemotePortName[];
  /** Предел ожидания вызова, мс. */
  timeoutMs?: number;
}

/**
 * Объект порта, каждый метод которого — вызов ядра по сети.
 *
 * `chain.initialize(username, wif)` — пустое действие: в монолите расширение
 * назначало подписанта своим ключом, вынесенному приложению ключ не
 * передаётся — действия цепи подписывает ядро. Метод оставлен, чтобы код
 * расширения переезжал без правок.
 */
export function remotePort(client: CorePortsClient, port: RemotePortName): object {
  const target: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of REMOTE_PORT_METHODS[port]) {
    target[method] = (...args: unknown[]) => client.call(port, method, args);
  }
  if (port === 'chain') target.initialize = () => undefined;
  return Object.freeze(target);
}

/**
 * Модуль портов ядра для приложения каталога.
 *
 * ```ts
 * ExtensionPortsModule.forRoot({ coreUrl: cfg.corePortsUrl, token: cfg.corePortsToken, ports: ['document'] })
 * // в сервисе приложения — как в монолите:
 * constructor(@Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort) {}
 * ```
 */
@Global()
@Module({})
export class ExtensionPortsModule {
  static forRoot(options: ExtensionPortsOptions): DynamicModule {
    const client = new CorePortsClient({ baseUrl: options.coreUrl, token: options.token, timeoutMs: options.timeoutMs });
    const providers: Provider[] = [
      { provide: CorePortsClient, useValue: client },
      ...options.ports.map((port) => ({ provide: REMOTE_PORT_TOKENS[port], useValue: remotePort(client, port) })),
    ];
    return { module: ExtensionPortsModule, providers, exports: providers.map((p) => (p as { provide: unknown }).provide) as any };
  }
}
