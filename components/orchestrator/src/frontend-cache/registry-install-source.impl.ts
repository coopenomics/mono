/**
 * @fileoverview Фронт приложения из реестра каталога по подписке кооператива (487-37).
 *
 * Узел кооператива берёт фронт приложения тем же путём, что образ и манифест:
 * вход кооператива в каталог (tenant JWT) → токен пакета по действующей
 * подписке → архив версии из реестра catalog-delivery → файл `install.js`.
 * Ключ оператора каталога узлу для этого не требуется: прежде фронт отдавал
 * catalog-operator под админским ключом, и ключ получал каждый узел.
 *
 * Исходы:
 *  - `ok` — файл найден; `declaredSha256` — из манифеста версии;
 *  - `notFound` — подписки, выпуска либо фронта у пакета нет;
 *  - `unavailable` — каталог не ответил, токен каталога ещё не передан: кэш не трогаем.
 */
import { gunzipSync } from 'node:zlib';
import { Logger } from '@nestjs/common';
import type { CatalogTenantToken } from '../watcher/catalog-tenant-token';
import type { FrontendInstallFetchOutcome, FrontendInstallSourcePort } from './ports';

const REQUEST_TIMEOUT_MS = 15_000;
/** Предел архива пакета: фронт приложения — сотни килобайт, предел держит память узла. */
const TARBALL_MAX_BYTES = 64 * 1024 * 1024;
/** Где в архиве пакета лежит фронт: корень либо сборка. Корень архива npm — `package/`. */
const INSTALL_SCRIPT_CANDIDATES = ['package/install.js', 'package/dist/install.js'] as const;
const TAR_BLOCK = 512;

interface PackumentLike {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, { dist?: { tarball?: string }; coopenomics?: { frontend?: { installSha256?: string } } }>;
}

/** Строка поля заголовка tar: до первого нулевого байта. */
function field(header: Buffer, start: number, length: number): string {
  const raw = header.subarray(start, start + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
}

/**
 * Найти файл в tar-архиве: первый из `wanted` по порядку предпочтения.
 * Читаются обычные файлы с короткими именами — фронт приложения лежит в
 * корне пакета, расширенные заголовки длинных имён ему не требуются.
 */
export function findInTar(tar: Buffer, wanted: readonly string[]): Buffer | null {
  const found = new Map<string, Buffer>();
  let offset = 0;
  while (offset + TAR_BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const prefix = field(header, 345, 155);
    const name = field(header, 0, 100);
    const size = Number.parseInt(field(header, 124, 12).trim() || '0', 8);
    if (!Number.isFinite(size) || size < 0) break;
    const path = prefix ? `${prefix}/${name}` : name;
    const type = header[156];
    const regular = type === 0 || type === 0x30;
    const start = offset + TAR_BLOCK;
    if (regular && wanted.includes(path) && start + size <= tar.length) {
      found.set(path, tar.subarray(start, start + size));
    }
    offset = start + Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
  }
  for (const path of wanted) {
    const content = found.get(path);
    if (content) return content;
  }
  return null;
}

export interface RegistryInstallSourceConfig {
  catalogDeliveryBaseUrl: string;
}

export class RegistryInstallSource implements FrontendInstallSourcePort {
  private readonly logger = new Logger(RegistryInstallSource.name);

  constructor(
    private readonly cfg: RegistryInstallSourceConfig,
    private readonly token: CatalogTenantToken,
  ) {}

  async fetchInstallScript(scope: string, name: string): Promise<FrontendInstallFetchOutcome> {
    const tenantJwt = this.token.get();
    if (tenantJwt === null) {
      return { status: 'unavailable', reason: 'токен кооператива в каталоге ещё не передан ядром' };
    }
    try {
      const pkg = `@${scope}/${name}`;
      const issued = await this.request('POST', `/v1/package/${pkg}/token`, tenantJwt);
      // Подписки нет либо пакета нет: фронту на узле делать нечего.
      if (issued.status === 403 || issued.status === 404) {
        return { status: 'notFound', reason: `каталог не выдал токен пакета ${pkg}: HTTP ${issued.status}` };
      }
      if (!issued.ok) return { status: 'unavailable', reason: `токен пакета ${pkg}: HTTP ${issued.status}` };
      const packageJwt = ((await issued.json()) as { token?: string }).token;
      if (typeof packageJwt !== 'string' || packageJwt.length === 0) {
        return { status: 'unavailable', reason: `каталог вернул пустой токен пакета ${pkg}` };
      }

      const listed = await this.request('GET', `/registry/${pkg}`, packageJwt);
      if (listed.status === 404) return { status: 'notFound', reason: `пакета ${pkg} нет в реестре каталога` };
      if (!listed.ok) return { status: 'unavailable', reason: `реестр каталога ${pkg}: HTTP ${listed.status}` };
      const packument = (await listed.json()) as PackumentLike;
      const version = packument['dist-tags']?.latest;
      const manifest = version ? packument.versions?.[version] : undefined;
      if (!version || !manifest) return { status: 'notFound', reason: `у пакета ${pkg} нет действующего выпуска` };

      // Имя архива — из манифеста версии; адрес узла в нём не используется: архив отдаёт тот же реестр.
      const declared = manifest.dist?.tarball?.split('/').pop();
      const filename = declared && declared.endsWith('.tgz') ? declared : `${name}-${version}.tgz`;
      const archive = await this.request('GET', `/registry/${pkg}/-/${encodeURIComponent(filename)}`, packageJwt);
      if (archive.status === 404) return { status: 'notFound', reason: `архива ${pkg}@${version} нет в реестре каталога` };
      if (!archive.ok) return { status: 'unavailable', reason: `архив ${pkg}@${version}: HTTP ${archive.status}` };
      const packed = Buffer.from(await archive.arrayBuffer());
      if (packed.length > TARBALL_MAX_BYTES) {
        return { status: 'unavailable', reason: `архив ${pkg}@${version} больше предела ${TARBALL_MAX_BYTES} байт` };
      }
      const content = findInTar(gunzipSync(packed, { maxOutputLength: TARBALL_MAX_BYTES }), INSTALL_SCRIPT_CANDIDATES);
      if (content === null) return { status: 'notFound', reason: `пакет ${pkg}@${version} не содержит install.js — фронт-части нет` };
      return {
        status: 'ok',
        content: Buffer.from(content),
        declaredSha256: manifest.coopenomics?.frontend?.installSha256 ?? null,
        version,
      };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`install.js из реестра @${scope}/${name} не получен: ${reason}`);
      return { status: 'unavailable', reason };
    }
  }

  private async request(method: string, path: string, bearer: string): Promise<Response> {
    return this.fetch(`${this.cfg.catalogDeliveryBaseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /** @internal protected — тесты подменяют транспорт без сети. */
  protected fetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }
}
