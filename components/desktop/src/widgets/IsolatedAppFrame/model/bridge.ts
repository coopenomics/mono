/**
 * Мост между столом и изолированной рамкой приложения каталога (487-18).
 *
 * Фронт приложения работает в рамке с отдельным происхождением: браузер не
 * даёт ему памяти стола, хранилища ключей, IndexedDB и токена пайщика. Со
 * столом рамка говорит сообщениями, и стол исполняет только команды из
 * {@link BRIDGE_METHODS}:
 *
 *  - `init`    — кто пайщик, какой кооператив, какая тема оформления;
 *  - `graphql` — запрос к бэкенду приложения. Стол сам подставляет токен
 *                приложения: ядро принимает его только для этого приложения,
 *                запросы ядра от имени пайщика им не выполнить;
 *  - `sign`    — подпись документа по хэшу. Текст для показа стол берёт у
 *                ядра, окно подписи рисует стол, ключ рамку не покидает.
 *
 * Токен пайщика, токен приложения и ключ в рамку не передаются.
 */

/** Признак сообщения моста и версия протокола. */
export const BRIDGE_MARK = 1;

/** Команды, которые стол исполняет для рамки. */
export const BRIDGE_METHODS = ['init', 'graphql', 'sign'] as const;
export type BridgeMethod = (typeof BRIDGE_METHODS)[number];

/** Предел длины запроса GraphQL от приложения, символов. */
const GRAPHQL_QUERY_MAX = 20_000;

/** Хэш документа: sha256 в шестнадцатеричной записи. */
const DOCUMENT_HASH_REGEX = /^[a-fA-F0-9]{64}$/;

/** Запрос рамки к столу. */
export interface BridgeRequest {
  id: string | number;
  method: BridgeMethod;
  params: Record<string, unknown>;
}

/** Причина, по которой сообщение рамки не исполняется. */
export type BridgeRefusal = 'notBridge' | 'unknownMethod' | 'badRequest';

/** Итог разбора сообщения рамки: запрос к исполнению либо причина отказа. */
export type BridgeParseResult = BridgeRequest | { refusal: BridgeRefusal; id?: string | number; method?: string };

/** Параметры `graphql`: запрос и переменные; `null` — составлены неверно. */
function graphqlParams(params: Record<string, unknown>): Record<string, unknown> | null {
  const { query, variables } = params;
  if (typeof query !== 'string' || query.length === 0 || query.length > GRAPHQL_QUERY_MAX) return null;
  if (variables === undefined) return { query, variables: {} };
  return typeof variables === 'object' && variables !== null ? { query, variables } : null;
}

/** Параметры `sign`: один хэш документа; `null` — хэша нет или он вне формата. */
function signParams(params: Record<string, unknown>): Record<string, unknown> | null {
  const { hash } = params;
  return typeof hash === 'string' && DOCUMENT_HASH_REGEX.test(hash) ? { hash: hash.toUpperCase() } : null;
}

/** Проверка параметров по командам; команда без параметров получает пустой объект. */
const PARAMS_OF: Record<BridgeMethod, (params: Record<string, unknown>) => Record<string, unknown> | null> = {
  init: () => ({}),
  graphql: graphqlParams,
  sign: signParams,
};

/** Идентификатор запроса рамки; `null` — сообщение не от моста. */
function bridgeId(data: unknown): { id: string | number; raw: Record<string, unknown> } | null {
  if (typeof data !== 'object' || data === null) return null;
  const raw = data as Record<string, unknown>;
  const id = raw.id;
  const marked = raw.coopBridge === BRIDGE_MARK && (typeof id === 'string' || typeof id === 'number');
  return marked ? { id: id as string | number, raw } : null;
}

/**
 * Разобрать сообщение рамки. Данные составил недоверенный код: каждое поле
 * проверяется, лишние поля отбрасываются.
 */
export function parseBridgeRequest(data: unknown): BridgeParseResult {
  const envelope = bridgeId(data);
  if (envelope === null) return { refusal: 'notBridge' };
  const { id, raw } = envelope;
  const method = raw.method;
  if (typeof method !== 'string' || !(BRIDGE_METHODS as readonly string[]).includes(method)) {
    return { refusal: 'unknownMethod', id, method: String(method) };
  }
  const given = typeof raw.params === 'object' && raw.params !== null ? (raw.params as Record<string, unknown>) : {};
  const params = PARAMS_OF[method as BridgeMethod](given);
  return params === null ? { refusal: 'badRequest', id } : { id, method: method as BridgeMethod, params };
}

/** Координаты пакета `@scope/name`; `null` — имя вне формата. */
export function packageCoords(packageId: string): { scope: string; name: string } | null {
  const match = /^@([a-z0-9][a-z0-9-]{0,63})\/([a-z0-9][a-z0-9-]{0,63})$/.exec(packageId);
  return match ? { scope: match[1], name: match[2] } : null;
}

/**
 * Политика содержимого рамки: сценарии и стили — только из самой страницы,
 * картинки — встроенные, сеть закрыта целиком. Запросы приложения идут
 * командой моста `graphql`, поэтому своя сеть рамке не требуется; без неё
 * страница не отправит наружу то, что показал ей пайщик.
 */
const FRAME_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'";

/**
 * Поставить политику первой в страницу приложения. Политика, объявленная
 * раньше содержимого, действует на всё, что идёт после неё: страница
 * может только ужесточить её, но не снять.
 */
export function withFramePolicy(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${FRAME_POLICY}">`;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  return doctype ? `${doctype[0]}${meta}${html.slice(doctype[0].length)}` : `${meta}${html}`;
}

