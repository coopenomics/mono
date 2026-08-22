/**
 * Политика версий схемы claims удостоверения (Story 4.10). Единый источник версии
 * для выпускаемого сертификата (`claim_schema_version`) и публичной политики
 * `/.well-known/coopid-schema-policy.json`, чтобы версия в удостоверении и версия
 * в опубликованной политике не разъезжались. Динамическая on-chain публикация
 * через COOPOS — Growth; здесь — статическая release-политика.
 */

/** Текущая версия схемы claims, которой подписываются новые удостоверения. */
export const CURRENT_SCHEMA_VERSION = '1';

/** Минимальная версия схемы, ещё принимаемая верификаторами. Ниже неё — отвергать. */
export const MIN_SUPPORTED_SCHEMA_VERSION = '1';

/** Карта депрекации `версия → дата прекращения поддержки` (ось формата; в MVP — пример). */
export const SCHEMA_DEPRECATION: Record<string, string> = { '0': '2026-01-01' };

export interface CoopIdSchemaPolicy {
  current_version: string;
  min_supported_version: string;
  deprecation: Record<string, string>;
}

/** Публичная политика версий схемы (для `/.well-known/coopid-schema-policy.json`). */
export function buildSchemaPolicy(): CoopIdSchemaPolicy {
  return {
    current_version: CURRENT_SCHEMA_VERSION,
    min_supported_version: MIN_SUPPORTED_SCHEMA_VERSION,
    deprecation: SCHEMA_DEPRECATION,
  };
}
