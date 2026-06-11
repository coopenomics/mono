/**
 * @fileoverview Volume-кэш фронт-частей расширений (E12-2).
 *
 * Watcher зовёт {@link FrontendCacheService.syncPackage} при установке /
 * обновлении / отзыве пакета; coopback читает кэш через REST
 * (`/v1/internal/extensions/frontend`, см. FrontendCacheController).
 * Так desktop получает только фронты пакетов, реально установленных у
 * кооператива (JWT-gated доставка), а не публичный каталог целиком.
 *
 * Раскладка на диске (FRONTEND_CACHE_DIR, volume — переживает рестарт):
 *
 *     <dir>/<scope>__<name>/install.js
 *     <dir>/<scope>__<name>/meta.json   ({@link CachedFrontendMeta})
 *
 * Цепочка проверки целостности перед записью в кэш:
 *  1. sha256 содержимого == `X-Install-Script-Sha256` ca-admin
 *     (транспорт не побился) — расхождение → reject;
 *  2. sha256 == `coopenomics.frontend.installSha256` из npm-манифеста
 *     версии в ca-auth registry (независимый канал по подписке) —
 *     декларация есть и не совпала → reject; verifier недоступен →
 *     fail-closed reject (непроверенный код не кэшируем); пакет не
 *     декларирует sha — принимаем по п.1.
 *
 * Семантика syncPackage по ответу источника:
 *  - ok → атомарная запись (tmp + rename);
 *  - notFound (релиз отозван / фронт-части больше нет) → evict;
 *  - unavailable → кэш не трогаем, живём на старой версии.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CachedFrontendMeta,
  FRONTEND_INSTALL_SOURCE,
  FRONTEND_MANIFEST_VERIFIER,
  FrontendInstallSourcePort,
  FrontendManifestVerifierPort,
} from './ports';

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const FRONTEND_CACHE_DIR = Symbol('FRONTEND_CACHE_DIR');

export type FrontendSyncOutcome =
  | { status: 'cached'; packageId: string; version: string; sha256: string }
  | { status: 'evicted'; packageId: string; reason: string }
  | { status: 'skipped'; packageId: string; reason: string }
  | { status: 'rejected'; packageId: string; reason: string };

@Injectable()
export class FrontendCacheService {
  private readonly logger = new Logger(FrontendCacheService.name);

  constructor(
    @Inject(FRONTEND_CACHE_DIR) private readonly cacheDir: string,
    @Inject(FRONTEND_INSTALL_SOURCE) private readonly source: FrontendInstallSourcePort,
    @Optional()
    @Inject(FRONTEND_MANIFEST_VERIFIER)
    private readonly verifier: FrontendManifestVerifierPort | null,
  ) {}

  /**
   * Привести кэш фронт-части пакета к состоянию активного релиза.
   * Идемпотентен — повторный вызов с тем же релизом перезапишет тем же
   * содержимым. Никогда не throw'ит: все исходы — discriminated outcome.
   */
  async syncPackage(packageId: string): Promise<FrontendSyncOutcome> {
    const coords = splitPackageId(packageId);
    if (coords === null) {
      return { status: 'skipped', packageId, reason: `packageId без @scope/name-формы: ${packageId}` };
    }

    const fetched = await this.source.fetchInstallScript(coords.scope, coords.name);
    if (fetched.status === 'unavailable') {
      this.logger.warn(`syncPackage ${packageId}: источник недоступен (${fetched.reason}) — кэш не тронут`);
      return { status: 'skipped', packageId, reason: fetched.reason };
    }
    if (fetched.status === 'notFound') {
      await this.evict(packageId);
      return { status: 'evicted', packageId, reason: fetched.reason };
    }

    const sha256 = createHash('sha256').update(fetched.content).digest('hex');
    if (fetched.declaredSha256 !== null && fetched.declaredSha256 !== sha256) {
      return this.rejected(
        packageId,
        `sha256 содержимого ${sha256} ≠ X-Install-Script-Sha256 ${fetched.declaredSha256}`,
      );
    }
    const version = fetched.version ?? 'unknown';

    if (this.verifier !== null && fetched.version !== null) {
      let manifestSha: string | null;
      try {
        manifestSha = await this.verifier.fetchInstallSha256(packageId, fetched.version);
      } catch (e) {
        // fail-closed: непроверенный install.js в кэш не пишем; старая
        // проверенная версия остаётся отдаваться.
        return this.rejected(
          packageId,
          `manifest-верификатор недоступен: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      if (manifestSha !== null && manifestSha !== sha256) {
        return this.rejected(
          packageId,
          `sha256 ${sha256} ≠ coopenomics.frontend.installSha256 ${manifestSha} (манифест ${version})`,
        );
      }
    }

    const meta: CachedFrontendMeta = {
      packageId,
      scope: coords.scope,
      name: coords.name,
      version,
      sha256,
      cachedAt: new Date().toISOString(),
    };
    await this.writeAtomic(this.entryDir(coords.scope, coords.name), fetched.content, meta);
    this.logger.log(`frontend cached: ${packageId}@${version} sha256=${sha256.slice(0, 12)}…`);
    return { status: 'cached', packageId, version, sha256 };
  }

  /** Убрать фронт-часть из кэша (отзыв релиза / истечение подписки). Идемпотентен. */
  async evict(packageId: string): Promise<void> {
    const coords = splitPackageId(packageId);
    if (coords === null) return;
    await rm(this.entryDir(coords.scope, coords.name), { recursive: true, force: true });
    this.logger.log(`frontend evicted: ${packageId}`);
  }

  /** Есть ли фронт-часть пакета в кэше (по meta.json на диске). */
  async isCached(packageId: string): Promise<boolean> {
    const coords = splitPackageId(packageId);
    if (coords === null) return false;
    return (await this.readMeta(coords.scope, coords.name)) !== null;
  }

  /** Список фактически установленных фронтов — скан каталога кэша. */
  async list(): Promise<CachedFrontendMeta[]> {
    let entries: string[];
    try {
      entries = await readdir(this.cacheDir);
    } catch {
      return [];
    }
    const items: CachedFrontendMeta[] = [];
    for (const entry of entries.sort()) {
      const sep = entry.indexOf('__');
      if (sep <= 0) continue;
      const meta = await this.readMeta(entry.slice(0, sep), entry.slice(sep + 2));
      if (meta !== null) items.push(meta);
    }
    return items;
  }

  /** Прочитать install.js + метаданные из кэша; null если не закэширован. */
  async read(
    scope: string,
    name: string,
  ): Promise<{ content: Buffer; meta: CachedFrontendMeta } | null> {
    const meta = await this.readMeta(scope, name);
    if (meta === null) return null;
    try {
      const content = await readFile(path.join(this.entryDir(scope, name), 'install.js'));
      return { content, meta };
    } catch {
      return null;
    }
  }

  private async readMeta(scope: string, name: string): Promise<CachedFrontendMeta | null> {
    if (!NAME_REGEX.test(scope) || !NAME_REGEX.test(name)) return null;
    try {
      const raw = await readFile(path.join(this.entryDir(scope, name), 'meta.json'), 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return isCachedFrontendMeta(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * tmp-каталог + rename: читатель никогда не видит полузаписанную пару
   * install.js/meta.json (rename на одной ФС атомарен).
   */
  private async writeAtomic(dir: string, content: Buffer, meta: CachedFrontendMeta): Promise<void> {
    const tmp = `${dir}.tmp-${process.pid}`;
    await rm(tmp, { recursive: true, force: true });
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'install.js'), content);
    await writeFile(path.join(tmp, 'meta.json'), JSON.stringify(meta, null, 2));
    await rm(dir, { recursive: true, force: true });
    await rename(tmp, dir);
  }

  private entryDir(scope: string, name: string): string {
    return path.join(this.cacheDir, `${scope}__${name}`);
  }

  private rejected(packageId: string, reason: string): FrontendSyncOutcome {
    this.logger.error(`syncPackage ${packageId} rejected: ${reason}`);
    return { status: 'rejected', packageId, reason };
  }
}

/** `@scope/name` → {scope, name}; null для неподдерживаемых форм. */
function splitPackageId(packageId: string): { scope: string; name: string } | null {
  const match = /^@([a-z0-9][a-z0-9-]{0,63})\/([a-z0-9][a-z0-9-]{0,63})$/.exec(packageId);
  if (!match) return null;
  return { scope: match[1], name: match[2] };
}

function isCachedFrontendMeta(value: unknown): value is CachedFrontendMeta {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.packageId === 'string' &&
    typeof v.scope === 'string' &&
    typeof v.name === 'string' &&
    typeof v.version === 'string' &&
    typeof v.sha256 === 'string' &&
    typeof v.cachedAt === 'string'
  );
}
