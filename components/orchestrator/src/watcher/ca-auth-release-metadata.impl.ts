/**
 * @fileoverview Реальный импл {@link ReleaseMetadataPort} — Story 10.5b.
 *
 * Откуда берётся install-spec: npm-манифест пакета в CA-auth pull-registry
 * (`GET /registry/:scope/:name`) содержит package.json каждой версии, а в
 * нём — секцию `coopenomics.backend` (image, subgraphPort, healthcheck;
 * Story 10.7a). Доступ к registry — по per-package JWT, который выдаётся
 * `POST /v1/package/:scope/:name/token` ТОЛЬКО при активной подписке
 * кооператива (signed-request подписью кооперативного ключа).
 *
 * Тот же JWT возвращается в spec'е как `pullJwt` — им же делается
 * docker login/pull. Так подписка кооператива остаётся единственным
 * источником доступа и к метаданным, и к артефактам.
 *
 * Если у версии нет `coopenomics.backend` — пакет frontend-only,
 * возвращаем `null` (desktop подхватит install.js своим поллингом).
 */
import { Logger } from '@nestjs/common';
import type { ReleaseInstallSpec, ReleaseMetadataPort } from './ports';
import { SignedRequestSigner } from './signed-request.client';

const REQUEST_TIMEOUT_MS = 10_000;

export interface CaAuthReleaseMetadataConfig {
  caAuthBaseUrl: string;
  coopname: string;
  /** WIF приватного ключа кооператива — для signed-request к CA-auth. */
  cooperativeWif: string;
  /** JWT_SECRET стенда — прокидывается в контейнер расширения. */
  jwtSecret: string;
  /** Docker-сеть, в которой поднимаются расширения (для containerEnv/DNS). */
  extensionsNetwork?: string;
}

interface NpmVersionManifest {
  coopenomics?: {
    backend?: {
      image?: string;
      subgraphPort?: number;
      healthcheck?: string;
      env?: string[];
    };
  };
}

interface NpmPackumentLike {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, NpmVersionManifest>;
}

export class CaAuthReleaseMetadata implements ReleaseMetadataPort {
  private readonly logger = new Logger(CaAuthReleaseMetadata.name);
  private readonly signer: SignedRequestSigner;

  constructor(private readonly cfg: CaAuthReleaseMetadataConfig) {
    this.signer = new SignedRequestSigner(cfg.coopname, cfg.cooperativeWif);
  }

  async fetchInstallSpec(opts: {
    packageId: string;
    version: string;
  }): Promise<ReleaseInstallSpec | null> {
    const coords = splitPackageId(opts.packageId);
    if (coords === null) {
      this.logger.warn(`packageId без @scope/name-формы: ${opts.packageId} → skip`);
      return null;
    }

    const jwt = await this.issuePackageJwt(coords);
    const packument = await this.fetchPackument(coords, jwt);

    const version =
      opts.version && opts.version !== 'active'
        ? opts.version
        : packument['dist-tags']?.latest;
    if (!version) {
      this.logger.warn(`${opts.packageId}: нет dist-tags.latest → skip`);
      return null;
    }
    const manifest = packument.versions?.[version];
    if (!manifest) {
      this.logger.warn(`${opts.packageId}@${version}: версии нет в registry → skip`);
      return null;
    }

    const backend = manifest.coopenomics?.backend;
    if (!backend?.image) {
      // frontend-only пакет: install.js подхватит desktop, контейнер не нужен.
      return null;
    }

    const port = backend.subgraphPort ?? 3001;
    const containerName = `ext-${coords.name}`.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const healthPath = backend.healthcheck ?? '/_health';

    return {
      url: `http://${containerName}:${port}/v1/graphql`,
      healthUrl: `http://${containerName}:${port}${healthPath.startsWith('/') ? healthPath : `/${healthPath}`}`,
      imageRef: backend.image,
      containerName,
      pullJwt: jwt,
      containerEnv: {
        SUBGRAPH_PORT: String(port),
        JWT_SECRET: this.cfg.jwtSecret,
        COOPNAME: this.cfg.coopname,
      },
    };
  }

  private async issuePackageJwt(coords: { scope: string; name: string }): Promise<string> {
    const path = `/v1/package/@${coords.scope}/${coords.name}/token`;
    const headers = this.signer.sign('POST', path, '');
    const body = (await this.request('POST', path, {
      ...headers,
    })) as { token?: string };
    if (typeof body.token !== 'string' || body.token.length === 0) {
      throw new Error(`CA-auth ${path}: пустой token`);
    }
    return body.token;
  }

  private async fetchPackument(
    coords: { scope: string; name: string },
    jwt: string,
  ): Promise<NpmPackumentLike> {
    const path = `/registry/@${coords.scope}/${coords.name}`;
    return (await this.request('GET', path, {
      Authorization: `Bearer ${jwt}`,
    })) as NpmPackumentLike;
  }

  private async request(
    method: string,
    path: string,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(`${this.cfg.caAuthBaseUrl}${path}`, {
        method,
        headers,
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        throw new Error(`CA-auth ${method} ${path} → HTTP ${resp.status}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

/** `@scope/name` → {scope, name}; null для неподдерживаемых форм. */
export function splitPackageId(
  packageId: string,
): { scope: string; name: string } | null {
  const match = /^@([a-z0-9][a-z0-9-]{0,63})\/([a-z0-9][a-z0-9-]{0,63})$/.exec(packageId);
  if (!match) return null;
  return { scope: match[1], name: match[2] };
}
