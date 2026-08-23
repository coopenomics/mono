import { Injectable, Logger } from '@nestjs/common';
import { PrivateKey } from '@wharfkit/antelope';
import axios, { type AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { platformSettings } from '@coopenomics/extension-kit';

/**
 * Достать `exp` (мс) из JWT без проверки подписи — нужен только для
 * планирования обновления токена, доверие к содержимому даёт ca-auth.
 * `null`, если токен не разбирается или `exp` отсутствует.
 */
function decodeJwtExpMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

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

export type SubscriptionState = 'trial' | 'active' | 'expired';

export interface ActivateSubscriptionInput {
  packageId: string;
  /** eosio::name плана; в MVP `'default'`. */
  plan?: string;
}

export type ActivateSubscriptionOutcome =
  | {
      status: 'activated';
      state: SubscriptionState;
      packageId: string;
      plan: string;
      startAt: string;
      endAt: string;
      freeTrialUsed: boolean;
    }
  | { status: 'alreadyActive'; error: string }
  | { status: 'clientNotRegistered'; error: string }
  | { status: 'unavailable'; error: string }
  | { status: 'failed'; error: string };

interface ActivateSubscriptionWireFormat {
  state: SubscriptionState;
  package_id: string;
  plan: string;
  start_at: string;
  end_at: string;
  free_trial_used: boolean;
}

/**
 * Метаданные фронт-части из volume-кэша orchestrator'а (E12-2):
 * только пакеты, реально установленные у кооператива, sha256 проверен
 * orchestrator'ом перед записью в кэш.
 */
export interface InstalledFrontendMeta {
  packageId: string;
  scope: string;
  name: string;
  version: string;
  sha256: string;
  cachedAt: string;
}

/** install.js из кэша orchestrator'а + заголовки целостности. */
export interface InstalledInstallScript {
  code: string;
  sha256: string | null;
  version: string | null;
}

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
  /**
   * Отдельный клиент для ca-auth (tenant-scoped endpoints). Базовый URL
   * и tenant JWT отличаются от ca-admin: ca-admin — admin API key
   * кооператива-оператора (voskhod); ca-auth — JWT кооператива-партнёра,
   * выписанный ca-admin'ом отдельно.
   */
  private readonly authClient: AxiosInstance | null;
  /**
   * Клиент к orchestrator'у контура (E12-3): список установленных
   * фронтов и install.js из его volume-кэша. Без auth-заголовков —
   * orchestrator доступен только внутри docker-сети контура.
   */
  private readonly orchestratorClient: AxiosInstance | null;

  /**
   * Кэш авто-выпущенного tenant JWT (ca-auth выдаёт их на 30 минут) и
   * его `exp` в миллисекундах. Обновляется лениво в
   * {@link ensureTenantJwt} с минутным запасом до истечения.
   */
  private tenantJwt: string | null = null;
  private tenantJwtExpMs = 0;

  /**
   * Настройки расширения — из env через ConfigService (как у chatcoop), а не
   * из `~/config/config` ядра: за границей контейнера этого пути нет. Имена
   * переменных и их валидация по-прежнему объявлены в zod-схеме ядра.
   */
  private readonly settings: {
    catalogUrl: string | undefined;
    catalogApiKey: string | undefined;
    authUrl: string | undefined;
    tenantJwt: string | undefined;
    cooperativeWif: string | undefined;
    orchestratorUrl: string | undefined;
  };

  constructor(configService: ConfigService) {
    const env = (name: string): string | undefined => {
      const value = configService.get<string>(name);
      return value === undefined || value === '' ? undefined : value;
    };
    this.settings = {
      catalogUrl: env('APPS_CATALOG_URL'),
      catalogApiKey: env('APPS_CATALOG_API_KEY'),
      authUrl: env('APPS_CATALOG_AUTH_URL'),
      tenantJwt: env('APPS_CATALOG_TENANT_JWT'),
      cooperativeWif: env('COOPERATIVE_WIF'),
      orchestratorUrl: env('ORCHESTRATOR_URL'),
    };
    const config = {
      apps_catalog: { url: this.settings.catalogUrl, api_key: this.settings.catalogApiKey },
      apps_catalog_auth: {
        url: this.settings.authUrl,
        tenant_jwt: this.settings.tenantJwt,
        cooperative_wif: this.settings.cooperativeWif,
      },
      orchestrator: { url: this.settings.orchestratorUrl },
    };
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
    if (
      config.apps_catalog_auth.url &&
      (config.apps_catalog_auth.tenant_jwt || config.apps_catalog_auth.cooperative_wif)
    ) {
      this.authClient = axios.create({
        baseURL: config.apps_catalog_auth.url,
        timeout: 5000,
      });
      // Tenant JWT живёт 30 минут — статический токен из env умирает
      // через полчаса после деплоя. Поэтому заголовок ставится
      // interceptor'ом: статический APPS_CATALOG_TENANT_JWT (если задан —
      // отладочный режим) или авто-выпущенный через challenge→verify
      // подписью COOPERATIVE_WIF, с кэшем и обновлением по истечении.
      this.authClient.interceptors.request.use(async (req) => {
        const jwt =
          config.apps_catalog_auth.tenant_jwt ?? (await this.ensureTenantJwt());
        req.headers.Authorization = `Bearer ${jwt}`;
        return req;
      });
    } else {
      this.authClient = null;
      this.logger.warn(
        'APPS_CATALOG_AUTH_URL + (COOPERATIVE_WIF или APPS_CATALOG_TENANT_JWT) не заданы — subscribe mutation в degraded mode',
      );
    }
    if (config.orchestrator.url) {
      this.orchestratorClient = axios.create({
        baseURL: config.orchestrator.url,
        timeout: 5000,
      });
    } else {
      this.orchestratorClient = null;
      this.logger.warn(
        'ORCHESTRATOR_URL не задан — install.js отдаётся напрямую из ca-admin без фильтра установленности (degraded)',
      );
    }
  }

  /** Сконфигурирован ли orchestrator-источник (E12-3 fallback-решение в контроллере). */
  get orchestratorConfigured(): boolean {
    return this.orchestratorClient !== null;
  }

  /**
   * E12-3: список фактически установленных фронт-частей из кэша
   * orchestrator'а. Без orchestrator'а (degraded) — пустой список:
   * расширения в этом режиме всё равно не устанавливаются.
   */
  async listInstalledFrontends(): Promise<InstalledFrontendMeta[]> {
    if (!this.orchestratorClient) return [];
    try {
      const res = await this.orchestratorClient.get<{ items: InstalledFrontendMeta[] }>(
        '/v1/internal/extensions/frontend',
      );
      return res.data.items ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`listInstalledFrontends failed: ${msg}`);
      return [];
    }
  }

  /**
   * E12-3: install.js установленного пакета из кэша orchestrator'а
   * вместе с заголовками целостности (sha256 + версия) — desktop сверяет
   * sha256 перед eval. `null` — фронт не установлен / orchestrator
   * недоступен; вызывающий контроллер решает, падать в 404 или в
   * fallback на прямой ca-admin путь (degraded dev-стенд).
   */
  async fetchInstalledInstallScript(
    scope: string,
    name: string,
  ): Promise<InstalledInstallScript | null> {
    if (!this.orchestratorClient) return null;
    try {
      const res = await this.orchestratorClient.get<string>(
        `/v1/internal/extensions/frontend/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/install.js`,
        { responseType: 'text', transformResponse: (data) => data as string },
      );
      const headers = res.headers as Record<string, unknown>;
      return {
        code: typeof res.data === 'string' ? res.data : String(res.data),
        sha256:
          typeof headers['x-install-script-sha256'] === 'string'
            ? (headers['x-install-script-sha256'] as string)
            : null,
        version:
          typeof headers['x-package-version'] === 'string'
            ? (headers['x-package-version'] as string)
            : null,
      };
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status !== 404) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`fetchInstalledInstallScript ${scope}/${name} failed: ${msg}`);
      }
      return null;
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

  /**
   * Story 9.3.b-sub: активация подписки кооператива-партнёра на пакет.
   *
   * Дёргает ca-auth `POST /v1/subscriptions/activate` с tenant JWT
   * кооператива. На первой попытке создаётся trial-подписка
   * (free_trial_period_seconds), на повторной активации после expired —
   * pay (min_payment_period_seconds). tenant читается ca-auth'ом только
   * из JWT — body не может переопределить кооператива.
   *
   * Discriminated outcome:
   *  - `activated` — HTTP 201, подписка ACTIVE/trial;
   *  - `alreadyActive` — HTTP 409 SUBSCRIPTION_ALREADY_ACTIVE;
   *  - `clientNotRegistered` — HTTP 403 CLIENT_NOT_REGISTERED: кооператив
   *    не зарегистрирован в каталоге восхода (нужен onboarding);
   *  - `unavailable` — HTTP 423 KE_UNAVAILABLE (катаклиз с key-escrow);
   *  - `failed` — прочие ошибки (network, 400, 401, degraded mode).
   */
  /**
   * Вернуть валидный tenant JWT кооператива, выпустив новый при
   * необходимости: `POST /v1/auth/challenge` → подпись challenge-строки
   * ключом `coopname@active` (COOPERATIVE_WIF) → `POST /v1/auth/verify`.
   * Токен кэшируется до `exp` с минутным запасом — при штатной работе
   * выпуск происходит раз в ~29 минут, а не на каждый запрос.
   *
   * Запросы идут чистым axios, не через `authClient`, — иначе
   * interceptor зациклится на самом себе.
   */
  private async ensureTenantJwt(): Promise<string> {
    const REFRESH_MARGIN_MS = 60_000;
    if (this.tenantJwt && Date.now() + REFRESH_MARGIN_MS < this.tenantJwtExpMs) {
      return this.tenantJwt;
    }
    const wif = this.settings.cooperativeWif;
    if (!wif) {
      throw new Error('COOPERATIVE_WIF не задан — tenant JWT выпустить нечем');
    }
    const base = this.settings.authUrl;
    const challengeRes = await axios.post<{ challenge_string?: string }>(
      `${base}/v1/auth/challenge`,
      { coopname: platformSettings().coopname },
      { timeout: 5000 },
    );
    const challenge = challengeRes.data?.challenge_string;
    if (typeof challenge !== 'string' || challenge.length === 0) {
      throw new Error('ca-auth /v1/auth/challenge: пустой challenge_string');
    }
    const signature = PrivateKey.from(wif).signMessage(Buffer.from(challenge)).toString();
    const verifyRes = await axios.post<{ token?: string }>(
      `${base}/v1/auth/verify`,
      { coopname: platformSettings().coopname, challenge_string: challenge, signature },
      { timeout: 5000 },
    );
    const token = verifyRes.data?.token;
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('ca-auth /v1/auth/verify: пустой token');
    }
    this.tenantJwt = token;
    this.tenantJwtExpMs = decodeJwtExpMs(token) ?? Date.now() + 5 * 60_000;
    this.logger.log(
      `tenant JWT обновлён (exp ${new Date(this.tenantJwtExpMs).toISOString()})`,
    );
    return token;
  }

  async activateSubscription(
    input: ActivateSubscriptionInput,
  ): Promise<ActivateSubscriptionOutcome> {
    if (!this.authClient) {
      const error =
        'APPS_CATALOG_AUTH_URL/APPS_CATALOG_TENANT_JWT не заданы';
      this.logger.warn(
        `activateSubscription refused (degraded mode): ${input.packageId}`,
      );
      return { status: 'failed', error };
    }
    try {
      const res = await this.authClient.post<ActivateSubscriptionWireFormat>(
        '/v1/subscriptions/activate',
        {
          package_id: input.packageId,
          ...(input.plan ? { plan: input.plan } : {}),
        },
      );
      return {
        status: 'activated',
        state: res.data.state,
        packageId: res.data.package_id,
        plan: res.data.plan,
        startAt: res.data.start_at,
        endAt: res.data.end_at,
        freeTrialUsed: res.data.free_trial_used,
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
      if (httpStatus === 409) {
        this.logger.warn(
          `activateSubscription alreadyActive ${input.packageId}: ${detail}`,
        );
        return { status: 'alreadyActive', error: detail };
      }
      if (httpStatus === 403) {
        this.logger.warn(
          `activateSubscription clientNotRegistered ${input.packageId}: ${detail}`,
        );
        return { status: 'clientNotRegistered', error: detail };
      }
      if (httpStatus === 423) {
        this.logger.warn(
          `activateSubscription unavailable ${input.packageId}: ${detail}`,
        );
        return { status: 'unavailable', error: detail };
      }
      this.logger.error(
        `activateSubscription failed ${input.packageId}: ${detail}`,
      );
      return { status: 'failed', error: detail };
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
