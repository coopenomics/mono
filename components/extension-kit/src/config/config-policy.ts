/**
 * Политика конфигурационного параметра расширения: кто его заполняет и можно ли
 * показывать его значение.
 *
 * Zod-схема отвечает на вопрос «какой у параметра тип и что считается валидным».
 * Она не отвечает на два других, от которых зависит безопасность: **видно ли
 * значение снаружи** и **чьё оно вообще**. Раньше ответа не было, и потому
 * `getExtensions` отдавал конфиг целиком — вместе с секретным ключом кассы
 * ЮKassa. Политика закрывает этот пробел, оставаясь рядом со схемой, а не
 * внутри неё: замена валидатора не должна уносить с собой признак секретности.
 */

/** Кто поставляет значение параметра. */
export enum ExtensionConfigSuppliedBy {
  /**
   * Кооператив. Председатель вводит значение при установке или в настройках
   * расширения; хранится в записи установки.
   */
  COOPERATIVE = 'cooperative',
  /**
   * Провайдер поставки. Значение приходит из конфигурации узла и в записи
   * установки не хранится вовсе. Председатель его не вводит и не видит: это
   * инфраструктура поставки, а не настройка кооператива.
   */
  PROVIDER = 'provider',
}

export interface ExtensionConfigFieldPolicy {
  /**
   * Значение не покидает сервер. Наружу уходит только признак «задано», сам
   * параметр редактируется в выдаче и в логах.
   */
  secret?: boolean;
  /** Кто заполняет. По умолчанию — кооператив. */
  suppliedBy?: ExtensionConfigSuppliedBy;
}

/**
 * Политика по параметрам расширения. Ключ — путь до поля в конфиге, точкой для
 * вложенных: `'secret'`, `'matrix.admin_password'`. Параметры без записи ведут
 * себя как несекретные и кооперативные — то есть ровно как сегодня.
 */
export type ExtensionConfigPolicy = Record<string, ExtensionConfigFieldPolicy>;

/**
 * Что подставляется вместо секретного значения в выдаче.
 *
 * Отдавать пустую строку нельзя: интерфейс не отличил бы «не задано» от
 * «задано, но скрыто», а председателю нужно видеть разницу — иначе он не
 * поймёт, работает расширение или ждёт ключа. Маркер также служит защитой при
 * сохранении формы: пришедшее обратно значение, равное маркеру, означает
 * «параметр не трогали», и сохранённый секрет остаётся на месте.
 */
export const EXTENSION_SECRET_SET = '__secret_set__';
export const EXTENSION_SECRET_UNSET = '';

/** Развернуть точечный путь в значение вложенного объекта. */
function readPath(source: any, path: string): any {
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), source);
}

/** Записать значение по точечному пути, создавая недостающие уровни. */
function writePath(target: any, path: string, value: any): void {
  const parts = path.split('.');
  const last = parts.pop() as string;
  let cursor = target;
  for (const part of parts) {
    if (typeof cursor[part] !== 'object' || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[last] = value;
}

/**
 * Заменить секретные значения маркерами перед отдачей наружу.
 *
 * Возвращает новый объект: исходный конфиг остаётся нетронутым, потому что тем
 * же объектом пользуется работающее расширение.
 */
export function redactSecretConfig<TConfig extends Record<string, any>>(
  config: TConfig,
  policy: ExtensionConfigPolicy | undefined
): TConfig {
  if (!policy) return config;

  const secretPaths = Object.keys(policy).filter((path) => policy[path]?.secret);
  if (secretPaths.length === 0) return config;

  const copy = structuredClone(config);
  for (const path of secretPaths) {
    const value = readPath(copy, path);
    const isSet = value !== undefined && value !== null && value !== '';
    writePath(copy, path, isSet ? EXTENSION_SECRET_SET : EXTENSION_SECRET_UNSET);
  }
  return copy;
}

/**
 * Собрать конфиг для сохранения: секретные параметры, пришедшие маркером
 * «задано», заменить на уже сохранённое значение.
 *
 * Без этого шага любое сохранение формы затирало бы секреты: интерфейс получил
 * маркер вместо значения и его же вернул бы обратно.
 */
export function mergeSecretConfig<TConfig extends Record<string, any>>(
  incoming: TConfig,
  stored: TConfig | undefined,
  policy: ExtensionConfigPolicy | undefined
): TConfig {
  if (!policy || !stored) return incoming;

  const merged = structuredClone(incoming);
  for (const path of Object.keys(policy)) {
    if (!policy[path]?.secret) continue;
    if (readPath(merged, path) !== EXTENSION_SECRET_SET) continue;
    writePath(merged, path, readPath(stored, path));
  }
  return merged;
}

/** Пути параметров, которые поставляет провайдер, — их не хранит запись установки. */
export function providerSuppliedPaths(policy: ExtensionConfigPolicy | undefined): string[] {
  if (!policy) return [];
  return Object.keys(policy).filter((path) => policy[path]?.suppliedBy === ExtensionConfigSuppliedBy.PROVIDER);
}
