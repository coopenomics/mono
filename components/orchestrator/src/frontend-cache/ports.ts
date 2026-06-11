/**
 * @fileoverview Порты кэша фронт-частей расширений (E12-2).
 *
 * Откуда берётся install.js: ca-admin отдаёт его из npm-tarball'а
 * АКТИВНОГО релиза (`GET /v1/public/packages/:scope/:name/install.js`,
 * E12-1) с заголовками `X-Install-Script-Sha256` / `X-Package-Version`.
 * Orchestrator скачивает скрипт при установке/обновлении пакета,
 * сверяет sha256 и кладёт в volume-кэш — desktop затем получает фронт
 * через coopback из этого кэша, а не напрямую из каталога.
 *
 * Зачем два порта:
 *  - {@link FrontendInstallSourcePort} — транспорт до ca-admin
 *    (admin API key контура); тесты подменяют fetch-стабом;
 *  - {@link FrontendManifestVerifierPort} — независимая сверка с
 *    декларацией `coopenomics.frontend.installSha256` из npm-манифеста
 *    в ca-auth registry (per-package JWT по подписке). Это другой
 *    контур и другой auth-канал, чем admin-key путь до ca-admin —
 *    подмена install.js на стороне ca-admin не пройдёт сверку.
 */

/** Результат скачивания install.js из каталога. */
export type FrontendInstallFetchOutcome =
  | {
      status: 'ok';
      /** Сырые байты install.js. */
      content: Buffer;
      /** sha256 из заголовка `X-Install-Script-Sha256` (или null, если ca-admin его не прислал). */
      declaredSha256: string | null;
      /** Версия активного релиза из `X-Package-Version` (или null). */
      version: string | null;
    }
  /** Нет активного релиза или у пакета нет фронт-части (HTTP 404). */
  | { status: 'notFound'; reason: string }
  /** Каталог недоступен/5xx/сеть — кэш не трогаем, живём на старом. */
  | { status: 'unavailable'; reason: string };

/** Порт скачивания install.js активного релиза из ca-admin. */
export interface FrontendInstallSourcePort {
  fetchInstallScript(scope: string, name: string): Promise<FrontendInstallFetchOutcome>;
}

export const FRONTEND_INSTALL_SOURCE = Symbol('FrontendInstallSourcePort');

/**
 * Порт независимой сверки sha256 install.js с декларацией пакета.
 *
 * Возвращает `installSha256` из `coopenomics.frontend` манифеста данной
 * версии в ca-auth registry, либо `null`, если пакет её не декларирует
 * (поле опционально в manifest-схеме каталога). Ошибка транспорта —
 * throw: вызывающий обязан fail-closed (не кэшировать непроверенное).
 */
export interface FrontendManifestVerifierPort {
  fetchInstallSha256(packageId: string, version: string): Promise<string | null>;
}

export const FRONTEND_MANIFEST_VERIFIER = Symbol('FrontendManifestVerifierPort');

/** Метаданные закэшированной фронт-части (содержимое meta.json). */
export interface CachedFrontendMeta {
  /** `@scope/name`. */
  packageId: string;
  scope: string;
  name: string;
  /** Версия релиза, из которого взят install.js. */
  version: string;
  /** sha256 содержимого install.js (hex). */
  sha256: string;
  /** ISO-время записи в кэш. */
  cachedAt: string;
}
