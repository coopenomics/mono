// i18n-ignore-file: сообщения мигратора о формате имени файла для разработчика и оператора, до пайщика не доходят
/**
 * Имя файла миграции данных — ключ её учёта и порядок применения.
 *
 * Два формата:
 * - `ГГГГММДДччмм__описание.ts` — текущий. Ключ — метка времени создания:
 *   её не нужно вычислять от предыдущего файла, и две ветки, заведшие миграцию
 *   параллельно, не получают один номер (а совпавший номер означал, что вторая
 *   миграция на живом узле молча пропускалась как «уже применённая»).
 * - `V<версия>__описание.ts` — прежний, заморожен. Эти файлы уже применены на
 *   узлах под своими версиями; переименовывать их нельзя — мигратор принял бы
 *   их за новые и прогнал заново.
 *
 * Порядок: сначала все прежние по версии, затем текущие по метке.
 */

const LEGACY = /^V(\d+(?:\.\d+)*)__(.+?)(?:\.[tj]s)?$/;
const TIMESTAMP = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})__(.+?)(?:\.[tj]s)?$/;

export interface MigrationFilename {
  /** Ключ учёта: `2.5.7` для прежних, `202609232115` для текущих. */
  version: string;
  /** Описание из имени, подчёркивания заменены пробелами. */
  description: string;
  /** Прежний формат `V…`. */
  legacy: boolean;
  /** Числа для сортировки: у прежних — части версии, у текущих — метка. */
  order: number[];
}

/**
 * Разобрать имя файла миграции данных.
 *
 * @throws Error Если имя не подходит ни под один формат либо метка не является датой.
 */
export function parseMigrationFilename(filename: string): MigrationFilename {
  const legacy = LEGACY.exec(filename);
  if (legacy) {
    return {
      version: legacy[1],
      description: legacy[2].replace(/_/g, ' '),
      legacy: true,
      order: legacy[1].split('.').map(Number),
    };
  }

  const current = TIMESTAMP.exec(filename);
  if (current) {
    const [, year, month, day, hour, minute, description] = current;
    const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute));
    const valid =
      date.getUTCFullYear() === +year &&
      date.getUTCMonth() === +month - 1 &&
      date.getUTCDate() === +day &&
      date.getUTCHours() === +hour &&
      date.getUTCMinutes() === +minute;
    if (!valid) throw new Error(`Метка времени в имени миграции не является датой: ${filename}`);
    const version = `${year}${month}${day}${hour}${minute}`;
    return { version, description: description.replace(/_/g, ' '), legacy: false, order: [Number(version)] };
  }

  throw new Error(
    `Неверное имя файла миграции: ${filename}. Ожидается ГГГГММДДччмм__описание.ts (прежние — V<версия>__описание.ts)`
  );
}

/** Файл миграции данных: `.ts`/`.js`, начинается с `V` или с цифры метки. */
export function isMigrationFile(filename: string): boolean {
  return /\.[tj]s$/.test(filename) && !filename.endsWith('.d.ts') && /^(V\d|\d{12}__)/.test(filename);
}

/** Сравнение для сортировки: прежние раньше текущих, внутри — по числам. */
export function compareMigrationFilenames(a: MigrationFilename, b: MigrationFilename): number {
  if (a.legacy !== b.legacy) return a.legacy ? -1 : 1;
  for (let i = 0; i < Math.max(a.order.length, b.order.length); i++) {
    const difference = (a.order[i] ?? 0) - (b.order[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Метка времени для нового файла миграции: `ГГГГММДДччмм` в UTC. */
export function migrationTimestamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`
  );
}
