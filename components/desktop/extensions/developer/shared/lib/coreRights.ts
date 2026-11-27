/**
 * Права ядра из заявки на модерацию.
 *
 * Каталог читает манифест версии (`coopenomics.ports`, `coopenomics.chainActions`)
 * и ставит перечень прав в начало пояснения к заявке — раньше текста издателя.
 * Стол разбирает перечень в структуру: модератор видит права отдельным блоком,
 * а текст издателя — отдельно. Перечень составляет каталог, не издатель:
 * издатель его не убирает и не сокращает.
 */

/** Права ядра, которые просит версия пакета. */
export interface CoreRights {
  /** Порты ядра: имена из `coopenomics.ports`. */
  ports: string[];
  /** Действия цепи вида `contract::action` из `coopenomics.chainActions`. */
  chainActions: string[];
  /** Обновление просит права сверх одобренных действующих выпусков. */
  expansion: boolean;
  /** Замечания каталога вместо прав: манифест не прочитан, сравнивать не с чем. */
  notes: string[];
}

export interface ModerationBrief {
  /** Права из перечня каталога; `null` — версия прав ядра не просит. */
  rights: CoreRights | null;
  /** Пояснение издателя без перечня прав. */
  text: string;
}

// i18n-ignore: служебные строки каталога приложений, по ним разбирается перечень прав
const REQUESTED = 'Права ядра';
// i18n-ignore: служебная строка каталога приложений
const EXPANSION = 'Обновление просит новые права ядра';
// i18n-ignore: служебная строка каталога приложений
const PORT = 'порт ';
// i18n-ignore: служебная строка каталога приложений
const CHAIN_ACTION = 'действие цепи ';

const PREFIX = new RegExp(`^(${REQUESTED}|${EXPANSION}): (.+?)\\.(?: |$)`);

/** Делит пояснение заявки на права ядра и текст издателя. */
export function splitModerationBrief(brief: string | null | undefined): ModerationBrief {
  const source = String(brief ?? '');
  const match = PREFIX.exec(source);
  if (!match) return { rights: null, text: source.trim() };
  const rights: CoreRights = { ports: [], chainActions: [], expansion: match[1] === EXPANSION, notes: [] };
  for (const item of match[2].split(', ')) {
    if (item.startsWith(PORT)) rights.ports.push(item.slice(PORT.length));
    else if (item.startsWith(CHAIN_ACTION)) rights.chainActions.push(item.slice(CHAIN_ACTION.length));
    else rights.notes.push(item);
  }
  return { rights, text: source.slice(match[0].length).trim() };
}
