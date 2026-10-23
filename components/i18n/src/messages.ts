/**
 * Словарь — дерево объектов, листья которого — сообщения в формате vue-i18n.
 * Ключ сообщения — путь через точку: `common.action.save`.
 */
export interface MessageTree {
  [key: string]: string | MessageTree;
}

export type LocaleMessages = Record<string, MessageTree>;

export class MessageCollisionError extends Error {
  constructor(public readonly key: string, public readonly sources: string[]) {
    super(`i18n: ключ «${key}» объявлен дважды (${sources.join(', ')})`);
    this.name = 'MessageCollisionError';
  }
}

function isTree(value: unknown): value is MessageTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Сливает словари в один. Два словаря не вправе объявить одно и то же
 * сообщение: второй перевод молча затёр бы первый, и текст на экране зависел
 * бы от порядка загрузки. Ветви (объекты) сливаются, листья — нет.
 */
export function mergeMessages(
  target: MessageTree,
  source: MessageTree,
  sourceName = 'словарь',
  path: string[] = [],
): MessageTree {
  for (const [key, value] of Object.entries(source)) {
    const keyPath = [...path, key];
    const existing = target[key];
    if (existing === undefined) {
      target[key] = isTree(value) ? mergeMessages({}, value, sourceName, keyPath) : value;
    } else if (isTree(existing) && isTree(value)) {
      mergeMessages(existing, value, sourceName, keyPath);
    } else {
      throw new MessageCollisionError(keyPath.join('.'), [sourceName]);
    }
  }
  return target;
}

/** Все ключи словаря плоским списком: `['common.action.save', …]`. */
export function flattenKeys(tree: MessageTree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (isTree(value)) keys.push(...flattenKeys(value, full));
    else keys.push(full);
  }
  return keys;
}

/** Сообщение по ключу или `undefined`, если ключа нет или это ветвь. */
export function getMessage(tree: MessageTree, key: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (!isTree(node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Есть ли в словаре ветвь с таким префиксом — для ключей, собранных в рантайме. */
export function hasBranch(tree: MessageTree, prefix: string): boolean {
  let node: string | MessageTree | undefined = tree;
  for (const part of prefix.split('.')) {
    if (!isTree(node)) return false;
    node = node[part];
  }
  return isTree(node);
}
