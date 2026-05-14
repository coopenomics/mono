/**
 * Наложение пользовательских «грязных» полей на дефолтное состояние формы.
 *
 * Используется в `buildInitialReportEdits`: берём только что посчитанные
 * дефолты (ledger2 + реквизиты + preview), поверх накладываем значения
 * из сохранённого черновика — но только те, что пользователь отредактировал
 * руками (есть в `editedFields`).
 *
 * Формат пути — простой точечный JSONPath без массивов:
 *   `balance.assetsTotal.otch`, `signer.lastName`.
 * Массивы в edits-DTO не используются (на 2026-04 все формы сводятся к
 * deeply-nested объектам; ПСВ с массивом ФИО — отдельный case, решается
 * при вводе формы ПСВ).
 */

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!path) return;
  const parts = path.split('.');
  let current: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = current[part];
    if (next === null || next === undefined || typeof next !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Возвращает deep-копию `defaults` с наложенными «грязными» полями из `draft`
 * по списку `editedFields`. Если в draft нет значения по path — пропускаем
 * (не затираем defaults на undefined).
 *
 * `defaults` не мутируется. Возвращается новый объект.
 */
export function applyDirtyOverrides(
  defaults: unknown,
  draft: unknown,
  editedFields: readonly string[],
): unknown {
  // structuredClone безопасен для JSON-подобных данных edits (строки/числа/
  // булы/объекты); для Date/Map/Set внутри использовался бы JSON-туда-сюда,
  // но в edits этого нет — структура плоская POJO.
  const merged = structuredClone(defaults);
  if (typeof merged !== 'object' || merged === null) return merged;
  const mergedObj = merged as Record<string, unknown>;

  for (const path of editedFields) {
    const draftValue = getByPath(draft, path);
    if (draftValue !== undefined) {
      setByPath(mergedObj, path, draftValue);
    }
  }
  return mergedObj;
}
