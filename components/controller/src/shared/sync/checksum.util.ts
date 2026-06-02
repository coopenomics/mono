import { createHash } from 'crypto';

/**
 * Story 6.4 (Epic 6): детерминированный checksum для блокчейн-зеркальных сущностей.
 *
 * Канонический JSON: ключи объектов сортируются лексикографически, массивы — order
 * preserved. На выходе одинаковая строка для любой перестановки ключей в исходном
 * объекте.
 *
 * Используется как фундамент для Epic 7 nightly snapshot (Story 7.3) и Epic 8
 * reconciliation deep-sample (Story 8.2): RPC отдаёт chain.tableRow → пересчитываем
 * checksum → сравниваем с `_checksum` в БД. Покрывает ТОЛЬКО `bc`-namespace
 * (то, что реально приходит из цепи); db-поля типа `matrix_room_id` локальные
 * и из цепи не получаются.
 */

export function canonicalStringify(value: unknown): string {
  if (value === undefined) return 'null'; // JSON.stringify(undefined) → undefined, делаем стабильно
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + canonicalStringify((value as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  }
  // function/symbol — никогда не доходит сюда для блокчейн-данных, но fallback:
  return JSON.stringify(String(value));
}

/**
 * Вычисляет sha256-hex от canonical-stringified bc-namespace.
 *
 * - `bc == null` → стабильный hash от `"null"` (legacy entity без namespace).
 * - 64 lowercase hex chars.
 */
export function computeBcChecksum(bc: object | null | undefined): string {
  const canon = canonicalStringify(bc ?? null);
  return createHash('sha256').update(canon, 'utf8').digest('hex');
}
