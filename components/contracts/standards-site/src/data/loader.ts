/**
 * Загрузчик YAML-манифестов стандартов.
 *
 * Подхватывает все `*.standard.yaml` в репозитории контрактов по glob
 * `../../cpp/**\/*.standard.yaml` через Vite `import.meta.glob` с `?raw`,
 * парсит каждый через `yaml.parse` и строит индекс стандартов.
 *
 * Запуск происходит синхронно на старте приложения — файлов немного (десятки),
 * парсинг быстрый. На рост — вынесем в async с Suspense.
 */

import { parse as parseYaml } from 'yaml';
import type {
  Standard,
  StandardIndex,
  StandardIndexEntry,
} from '@/types/standard';

// eager:true + query:'?raw' — Vite отдаёт сразу строки YAML; default — содержимое.
// Путь относительно src/data/loader.ts → ../../../cpp/ = components/contracts/cpp/
const rawModules = import.meta.glob('../../../cpp/**/*.standard.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

/**
 * Проверить, похож ли объект на валидный Standard.
 * Мягкая валидация — только ключевые поля для индекса.
 */
function isStandardLike(
  value: unknown,
): value is Standard {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Partial<Standard>;
  return Boolean(v.process_type && v.title && v.contract && v.slug);
}

function buildIndex(): StandardIndex {
  const byProcessType: Record<string, Standard> = {};
  const byContract: Record<string, StandardIndexEntry[]> = {};

  for (const [filePath, rawContent] of Object.entries(rawModules)) {
    let parsed: unknown;
    try {
      parsed = parseYaml(rawContent);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[standards] YAML parse error in ${filePath}:`, err);
      continue;
    }

    if (!isStandardLike(parsed)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[standards] Файл ${filePath} не похож на standard-манифест ` +
        `(обязательные поля: process_type, title, contract, slug)`,
      );
      continue;
    }

    if (byProcessType[parsed.process_type]) {
      // eslint-disable-next-line no-console
      console.warn(
        `[standards] Дубликат process_type "${parsed.process_type}" в ${filePath}`,
      );
      continue;
    }

    byProcessType[parsed.process_type] = parsed;
    const entry: StandardIndexEntry = {
      process_type: parsed.process_type,
      title: parsed.title,
      contract: parsed.contract,
      slug: parsed.slug,
      path: filePath,
      status: parsed.status,
    };
    (byContract[parsed.contract] ??= []).push(entry);
  }

  // Стабильная сортировка внутри контракта — по title.
  for (const list of Object.values(byContract)) {
    list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }
  const contracts = Object.keys(byContract).sort();

  return { byProcessType, byContract, contracts };
}

// Экспорт — один индекс на всё приложение.
export const standardsIndex: StandardIndex = buildIndex();

export function getStandard(processType: string): Standard | undefined {
  return standardsIndex.byProcessType[processType];
}
