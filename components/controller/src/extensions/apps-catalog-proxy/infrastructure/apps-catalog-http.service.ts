import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import config from '~/config/config';

interface PublicPackageWireFormat {
  package_id: string;
  owner_username: string;
  compatible_subnets: string[];
  last_active_version: string | null;
}

export interface AppsCatalogPackage {
  packageId: string;
  publisher: string;
  compatibleSubnets: string[];
  lastActiveVersion: string | null;
}

export interface RegisterPackageInput {
  packageId: string;
  ownerUsername: string;
  compatibleSubnets: string[];
  /** Optional. Если не передан — генерируется uuidv4. */
  requestId?: string;
}

export type RegisterPackageOutcome =
  | { status: 'applied'; requestId: string }
  | { status: 'conflict'; requestId: string; error: string }
  | { status: 'failed'; requestId: string; error: string };

export interface CreateReleaseInput {
  packageId: string;
  version: string;
  manifest: Record<string, unknown>;
  tarballSha256?: string;
  requestId?: string;
}

export type CreateReleaseOutcome =
  | { status: 'applied'; requestId: string; transactionId?: string }
  | { status: 'invalidManifest'; requestId: string; error: string }
  | { status: 'failed'; requestId: string; error: string };

export type ModerationStatus =
  | 'SUBMITTED'
  | 'WITHDRAWN'
  | 'APPROVED'
  | 'APPROVED_PENDING_CHAIN'
  | 'REJECTED';

export interface ModerationRequestRow {
  id: string;
  packageId: string;
  version: string;
  scope: unknown;
  brief: string;
  releaseType: 'full' | 'canary';
  status: ModerationStatus;
  submittedBy: string;
  submittedAt: string;
  updatedAt: string;
  requiresOverride: boolean;
}

interface ModerationRequestWireFormat {
  id: string;
  package_id: string;
  version: string;
  scope: unknown;
  brief: string;
  release_type: 'full' | 'canary';
  status: ModerationStatus;
  submitted_by: string;
  submitted_at: string;
  updated_at: string;
  requires_override: boolean;
}

export type ReleaseScopeInput =
  | { type: 'all' }
  | { type: 'empty' }
  | { type: 'subnets'; subnets: string[] }
  | { type: 'cooperatives'; coopnames: string[] };

export interface ApproveModerationInput {
  moderationId: string;
  scope: ReleaseScopeInput;
  override?: boolean;
  requestId?: string;
}

export type ApproveModerationOutcome =
  | {
      status: 'applied';
      requestId: string;
      packageId: string;
      version: string;
    }
  | {
      status: 'pendingChain';
      requestId: string;
      error: string;
    }
  | {
      status: 'conflict';
      requestId: string;
      error: string;
    }
  | {
      status: 'requiresOverride';
      requestId: string;
      error: string;
    }
  | {
      status: 'failed';
      requestId: string;
      error: string;
    };

export interface RejectModerationInput {
  moderationId: string;
  reason: string;
  requestId?: string;
}

export type RejectModerationOutcome =
  | { status: 'applied'; requestId: string }
  | { status: 'conflict'; requestId: string; error: string }
  | { status: 'failed'; requestId: string; error: string };

/**
 * HTTP-клиент к ca-admin (apps-catalog) для Story 9.5.b. Защищён admin-API
 * ключом из env (APPS_CATALOG_API_KEY). Используется только сервером —
 * ключ в браузер не утекает.
 *
 * Degraded mode: если APPS_CATALOG_URL / APPS_CATALOG_API_KEY не заданы —
 * возвращает пустой список вместо ошибки, чтобы dev-окружение без
 * apps-catalog (или CI без сети) не валило desktop boot.
 */
@Injectable()
export class AppsCatalogHttpService {
  private readonly logger = new Logger(AppsCatalogHttpService.name);
  private readonly client: AxiosInstance | null;

  constructor() {
    if (config.apps_catalog.url && config.apps_catalog.api_key) {
      this.client = axios.create({
        baseURL: config.apps_catalog.url,
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${config.apps_catalog.api_key}`,
        },
      });
    } else {
      this.client = null;
      this.logger.warn(
        'APPS_CATALOG_URL/APPS_CATALOG_API_KEY не заданы — apps-catalog-proxy в degraded mode (пустой каталог)',
      );
    }
  }

  async listPublicPackages(page = 1, pageSize = 50): Promise<AppsCatalogPackage[]> {
    if (!this.client) return [];
    try {
      const res = await this.client.get<PublicPackageWireFormat[]>(
        '/v1/public/packages',
        { params: { page, page_size: pageSize } },
      );
      return res.data.map((p) => ({
        packageId: p.package_id,
        publisher: p.owner_username,
        compatibleSubnets: p.compatible_subnets,
        lastActiveVersion: p.last_active_version,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`apps-catalog list failed: ${msg}`);
      return [];
    }
  }

  /**
   * Story 9.4.b: получить install.js пакета remote-расширения.
   *
   * Возвращает plain CJS-текст из ca-admin endpoint'а
   * `GET /v1/public/packages/:scope/:name/install.js`. На degraded mode
   * (без env-config'а apps-catalog'а) либо если ca-admin отвечает 404
   * — возвращает `null`, чтобы desktop'у было ясно «нет такого пакета /
   * каталог недоступен» вместо ошибки 500 в браузере.
   *
   * @param scope владелец пакета (`voskhod` из `@voskhod/demo-app`).
   * @param name  short-name пакета (`demo-app`).
   */
  /**
   * Story 9.3.b-pub: первичная регистрация пакета в каталоге.
   *
   * Прокидывает входной DTO на ca-admin `POST /v1/admin/package`. ca-admin
   * сам подписывает on-chain action `apps::regpkg` от имени chairman'а
   * кооператива-оператора каталога (voskhod на dev) — поэтому здесь не
   * требуется session-key пайщика.
   *
   * Discriminated outcome (vs. throw):
   *  - `applied` — HTTP 200, on-chain transaction подтверждён;
   *  - `conflict` — HTTP 409 (пакет уже зарегистрирован или дубликат
   *    `request_id`); resolver мапит на `status: 'conflict'`;
   *  - `failed` — любое прочее (network, 400, 401, degraded-mode без
   *    APPS_CATALOG_API_KEY); resolver мапит на `status: 'failed'`.
   *
   * Degraded mode (нет client'а) — возвращает `failed` с явным сообщением:
   * mutation в degraded-стенде не делает silent no-op, чтобы UI не
   * вводился в заблуждение «пакет опубликован».
   */
  async registerPackage(
    input: RegisterPackageInput,
  ): Promise<RegisterPackageOutcome> {
    const requestId = input.requestId ?? uuidv4();
    if (!this.client) {
      const error = 'APPS_CATALOG_URL/APPS_CATALOG_API_KEY не заданы';
      this.logger.warn(
        `registerPackage refused (degraded mode): ${input.packageId}`,
      );
      return { status: 'failed', requestId, error };
    }
    try {
      await this.client.post('/v1/admin/package', {
        request_id: requestId,
        package_id: input.packageId,
        owner_username: input.ownerUsername,
        compatible_subnets: input.compatibleSubnets,
      });
      return { status: 'applied', requestId };
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      const responseData = (err as AxiosError).response?.data;
      const detail =
        typeof responseData === 'object' && responseData
          ? JSON.stringify(responseData)
          : err instanceof Error
            ? err.message
            : String(err);
      if (status === 409) {
        this.logger.warn(
          `registerPackage conflict для ${input.packageId}: ${detail}`,
        );
        return { status: 'conflict', requestId, error: detail };
      }
      this.logger.error(
        `registerPackage failed для ${input.packageId}: ${detail}`,
      );
      return { status: 'failed', requestId, error: detail };
    }
  }

  /**
   * Story 9.3.b-rel: создание нового релиза пакета (action `apps::setrelease`).
   *
   * Прокидывает manifest + версию на ca-admin `POST /v1/admin/releases`.
   * ca-admin сам валидирует manifest Zod-схемой и подписывает on-chain.
   *
   * Discriminated outcome:
   *  - `applied` — HTTP 200, on-chain прошёл; в payload может быть
   *    `transaction_id` (если адаптер не stub'овый);
   *  - `invalidManifest` — HTTP 422 INVALID_MANIFEST (manifest не прошёл
   *    Zod-валидацию на стороне ca-admin); `error` содержит детали
   *    валидации в стабильном формате;
   *  - `failed` — прочие ошибки (network, 401, 503, degraded-mode).
   */
  async createRelease(input: CreateReleaseInput): Promise<CreateReleaseOutcome> {
    const requestId = input.requestId ?? uuidv4();
    if (!this.client) {
      const error = 'APPS_CATALOG_URL/APPS_CATALOG_API_KEY не заданы';
      this.logger.warn(
        `createRelease refused (degraded mode): ${input.packageId}@${input.version}`,
      );
      return { status: 'failed', requestId, error };
    }
    try {
      const res = await this.client.post<{
        ok: boolean;
        transaction_id?: string;
      }>('/v1/admin/releases', {
        request_id: requestId,
        package_id: input.packageId,
        version: input.version,
        manifest: input.manifest,
        ...(input.tarballSha256
          ? { tarball_sha256: input.tarballSha256 }
          : {}),
      });
      return {
        status: 'applied',
        requestId,
        transactionId: res.data?.transaction_id,
      };
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      const responseData = (err as AxiosError).response?.data;
      const detail =
        typeof responseData === 'object' && responseData
          ? JSON.stringify(responseData)
          : err instanceof Error
            ? err.message
            : String(err);
      if (status === 422) {
        this.logger.warn(
          `createRelease invalidManifest для ${input.packageId}@${input.version}: ${detail}`,
        );
        return { status: 'invalidManifest', requestId, error: detail };
      }
      this.logger.error(
        `createRelease failed для ${input.packageId}@${input.version}: ${detail}`,
      );
      return { status: 'failed', requestId, error: detail };
    }
  }

  /**
   * Story 9.9: список заявок на модерацию по статусу.
   *
   * Дёргает ca-admin `GET /v1/admin/moderation?status=...&limit=...`.
   * Используется столом восхода (chairman voskhod) для просмотра pending
   * заявок и принятия решения (approve/reject).
   *
   * Degraded mode (нет ca-admin client'а) → пустой массив, чтобы UI
   * нормально показал «pending пусто» вместо ошибки.
   */
  async listSubmittedModerations(
    status: ModerationStatus = 'SUBMITTED',
    limit?: number,
  ): Promise<ModerationRequestRow[]> {
    if (!this.client) return [];
    try {
      const params: Record<string, string | number> = { status };
      if (limit !== undefined) params.limit = limit;
      const res = await this.client.get<{
        items: ModerationRequestWireFormat[];
      }>('/v1/admin/moderation', { params });
      return res.data.items.map((r) => ({
        id: r.id,
        packageId: r.package_id,
        version: r.version,
        scope: r.scope,
        brief: r.brief,
        releaseType: r.release_type,
        status: r.status,
        submittedBy: r.submitted_by,
        submittedAt: r.submitted_at,
        updatedAt: r.updated_at,
        requiresOverride: r.requires_override,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`listSubmittedModerations failed: ${msg}`);
      return [];
    }
  }

  /**
   * Story 9.9: chairman восхода одобряет заявку на модерацию.
   *
   * Дёргает ca-admin `POST /v1/admin/moderation/:id/approve`. ca-admin
   * атомарно переводит moderation в APPROVED, активирует release и
   * выкладывает outbox-event `release.activated` (он же триггер для
   * on-chain `apps::setrelease` и orchestrator'а install pipeline).
   *
   * Discriminated outcome:
   *  - `applied` — HTTP 200, release ACTIVE, package_id/version в payload;
   *  - `pendingChain` — HTTP 423 APPROVED_PENDING_CHAIN: moderation
   *    одобрена, но on-chain провалился; recovery worker повторит;
   *  - `conflict` — HTTP 409: заявка не в SUBMITTED (уже approved /
   *    withdrawn);
   *  - `requiresOverride` — HTTP 403: scan_report критичен, нужен
   *    явный `override: true`;
   *  - `failed` — прочие ошибки.
   */
  async approveModeration(
    input: ApproveModerationInput,
  ): Promise<ApproveModerationOutcome> {
    const requestId = input.requestId ?? uuidv4();
    if (!this.client) {
      const error = 'APPS_CATALOG_URL/APPS_CATALOG_API_KEY не заданы';
      this.logger.warn(
        `approveModeration refused (degraded mode): ${input.moderationId}`,
      );
      return { status: 'failed', requestId, error };
    }
    try {
      const res = await this.client.post<{
        ok: boolean;
        package_id: string;
        version: string;
        request_id: string;
      }>(`/v1/admin/moderation/${encodeURIComponent(input.moderationId)}/approve`, {
        request_id: requestId,
        scope: input.scope,
        ...(input.override !== undefined ? { override: input.override } : {}),
      });
      return {
        status: 'applied',
        requestId: res.data.request_id ?? requestId,
        packageId: res.data.package_id,
        version: res.data.version,
      };
    } catch (err) {
      const httpStatus = (err as AxiosError).response?.status;
      const responseData = (err as AxiosError).response?.data;
      const detail =
        typeof responseData === 'object' && responseData
          ? JSON.stringify(responseData)
          : err instanceof Error
            ? err.message
            : String(err);
      if (httpStatus === 423) {
        this.logger.warn(
          `approveModeration pendingChain ${input.moderationId}: ${detail}`,
        );
        return { status: 'pendingChain', requestId, error: detail };
      }
      if (httpStatus === 409) {
        this.logger.warn(
          `approveModeration conflict ${input.moderationId}: ${detail}`,
        );
        return { status: 'conflict', requestId, error: detail };
      }
      if (httpStatus === 403) {
        this.logger.warn(
          `approveModeration requiresOverride ${input.moderationId}: ${detail}`,
        );
        return { status: 'requiresOverride', requestId, error: detail };
      }
      this.logger.error(
        `approveModeration failed ${input.moderationId}: ${detail}`,
      );
      return { status: 'failed', requestId, error: detail };
    }
  }

  /**
   * Story 9.9: chairman восхода отклоняет заявку на модерацию.
   *
   * Дёргает ca-admin `POST /v1/admin/moderation/:id/reject` с `reason`.
   * ca-admin переводит moderation в REJECTED (compare-and-set из
   * SUBMITTED) и пишет аудит-запись.
   *
   * Discriminated outcome:
   *  - `applied` — HTTP 200, заявка REJECTED;
   *  - `conflict` — HTTP 409: заявка уже не в SUBMITTED;
   *  - `failed` — прочие ошибки.
   */
  async rejectModeration(
    input: RejectModerationInput,
  ): Promise<RejectModerationOutcome> {
    const requestId = input.requestId ?? uuidv4();
    if (!this.client) {
      const error = 'APPS_CATALOG_URL/APPS_CATALOG_API_KEY не заданы';
      this.logger.warn(
        `rejectModeration refused (degraded mode): ${input.moderationId}`,
      );
      return { status: 'failed', requestId, error };
    }
    try {
      await this.client.post(
        `/v1/admin/moderation/${encodeURIComponent(input.moderationId)}/reject`,
        {
          request_id: requestId,
          reason: input.reason,
        },
      );
      return { status: 'applied', requestId };
    } catch (err) {
      const httpStatus = (err as AxiosError).response?.status;
      const responseData = (err as AxiosError).response?.data;
      const detail =
        typeof responseData === 'object' && responseData
          ? JSON.stringify(responseData)
          : err instanceof Error
            ? err.message
            : String(err);
      if (httpStatus === 409) {
        this.logger.warn(
          `rejectModeration conflict ${input.moderationId}: ${detail}`,
        );
        return { status: 'conflict', requestId, error: detail };
      }
      this.logger.error(
        `rejectModeration failed ${input.moderationId}: ${detail}`,
      );
      return { status: 'failed', requestId, error: detail };
    }
  }

  async fetchInstallScript(scope: string, name: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.get<string>(
        `/v1/public/packages/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/install.js`,
        { responseType: 'text', transformResponse: (data) => data as string },
      );
      return typeof res.data === 'string' ? res.data : String(res.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `apps-catalog install.js fetch failed for ${scope}/${name}: ${msg}`,
      );
      return null;
    }
  }
}
