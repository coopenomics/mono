import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InnerKeyPermission, VAULT_PORT, type IVaultPort } from '@coopenomics/innercoop';
import { PrivateKey } from '@wharfkit/antelope';
import axios, { type AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { platformSettings } from '@coopenomics/extension-kit';
import { t } from '../i18n';

/** Код HTTP и текст отказа каталога: тело ответа, если оно есть, иначе сообщение ошибки. */
function failureOf(err: unknown): { status: number | undefined; detail: string } {
  const response = (err as AxiosError).response;
  const data = response?.data;
  let detail: string;
  if (typeof data === 'object' && data) detail = JSON.stringify(data);
  else detail = err instanceof Error ? err.message : String(err);
  return { status: response?.status, detail };
}

/**
 * Достать `exp` (мс) из JWT без проверки подписи — нужен только для
 * планирования обновления токена, доверие к содержимому даёт catalog-delivery.
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
  /** Кратко, что изменилось — уходит в заявку на модерацию. */
  brief?: string;
  requestId?: string;
}

/**
 * 487-27: релиз подаётся tenant-путём catalog-delivery `POST /v1/releases`.
 * `applied` — пакет доверенный, релиз активирован сразу; `queued` —
 * первый релиз пакета, ждёт модератора; `notPublished` — версии нет в
 * реестре (сначала `npm publish`); `conflict` — версия уже подана.
 */
export type CreateReleaseOutcome =
  | { status: 'applied'; requestId: string; moderationId: string }
  | { status: 'queued'; requestId: string; moderationId: string }
  | { status: 'notPublished'; requestId: string; error: string }
  | { status: 'conflict'; requestId: string; error: string }
  | { status: 'invalidManifest'; requestId: string; error: string }
  | { status: 'failed'; requestId: string; error: string };

/** Publisher-токен издателя-пайщика (487-27), как отдаёт catalog-delivery. */
export interface PublisherTokenWire {
  id: string;
  username: string;
  package_id: string;
  label: string;
  token_prefix: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface CreatePublisherTokenInput {
  username: string;
  /** Пакет, на который выдаётся ключ (ключ = один пакет). */
  packageId: string;
  label: string;
  createdBy: string;
  expiresInDays?: number;
}

export type CreatePublisherTokenOutcome =
  | { status: 'created'; token: string; record: PublisherTokenWire }
  | { status: 'failed'; error: string };

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
 * HTTP-клиент к catalog-operator (apps-catalog) для Story 9.5.b. Защищён admin-API
 * ключом из env (APPS_CATALOG_OPERATOR_API_KEY). Используется только сервером —
 * ключ в браузер не утекает.
 *
 * Degraded mode: если APPS_CATALOG_OPERATOR_URL / APPS_CATALOG_OPERATOR_API_KEY не заданы —
 * возвращает пустой список вместо ошибки, чтобы dev-окружение без
 * apps-catalog (или CI без сети) не валило desktop boot.
 */
/**
 * Как часто ядро передаёт оркестратору tenant JWT каталога. Каталог выдаёт
 * токен на 30 минут; раз в 10 минут оркестратор получает свежий задолго до
 * истечения прежнего.
 */
const ORCHESTRATOR_TOKEN_PUSH_MS = 10 * 60_000;

@Injectable()
export class AppsCatalogHttpService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppsCatalogHttpService.name);
  private readonly client: AxiosInstance | null;
  /**
   * Отдельный клиент для catalog-delivery (tenant-scoped endpoints). Базовый URL
   * и tenant JWT отличаются от catalog-operator: catalog-operator — admin API key
   * кооператива-оператора (voskhod); catalog-delivery — JWT кооператива-партнёра,
   * выписанный catalog-operator'ом отдельно.
   */
  private readonly authClient: AxiosInstance | null;
  /**
   * Клиент к orchestrator'у контура (E12-3): список установленных
   * фронтов и install.js из его volume-кэша. Без auth-заголовков —
   * orchestrator доступен только внутри docker-сети контура.
   */
  private readonly orchestratorClient: AxiosInstance | null;

  /**
   * Кэш авто-выпущенного tenant JWT (catalog-delivery выдаёт их на 30 минут) и
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
    orchestratorUrl: string | undefined;
  };

  constructor(
    configService: ConfigService,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort,
  ) {
    const env = (name: string): string | undefined => {
      const value = configService.get<string>(name);
      return value === undefined || value === '' ? undefined : value;
    };
    this.settings = {
      catalogUrl: env('APPS_CATALOG_OPERATOR_URL'),
      catalogApiKey: env('APPS_CATALOG_OPERATOR_API_KEY'),
      authUrl: env('APPS_CATALOG_DELIVERY_URL'),
      tenantJwt: env('APPS_CATALOG_TENANT_JWT'),
      orchestratorUrl: env('ORCHESTRATOR_URL'),
    };
    this.client = this.createAdminClient();
    this.authClient = this.createAuthClient();
    this.orchestratorClient = this.createOrchestratorClient();
  }

  /** Клиент catalog-operator под admin API-ключом; без адреса и ключа — режим деградации. */
  private createAdminClient(): AxiosInstance | null {
    const { catalogUrl, catalogApiKey } = this.settings;
    if (catalogUrl && catalogApiKey) {
      return axios.create({
        baseURL: catalogUrl,
        timeout: 5000,
        headers: { Authorization: `Bearer ${catalogApiKey}` },
      });
    }
    this.logger.warn(
      'APPS_CATALOG_OPERATOR_URL/APPS_CATALOG_OPERATOR_API_KEY не заданы — apps-catalog-proxy в degraded mode (пустой каталог)',
    );
    return null;
  }

  /** Клиент catalog-delivery под tenant JWT кооператива; без адреса и ключа — режим деградации. */
  private createAuthClient(): AxiosInstance | null {
    const { authUrl, tenantJwt } = this.settings;
    if (!authUrl) {
      this.logger.warn(
        'APPS_CATALOG_DELIVERY_URL не задан — subscribe mutation в degraded mode',
      );
      return null;
    }
    const authClient = axios.create({ baseURL: authUrl, timeout: 5000 });
    // Tenant JWT живёт 30 минут — статический токен из env умирает
    // через полчаса после деплоя. Поэтому заголовок ставится
    // interceptor'ом: статический APPS_CATALOG_TENANT_JWT (если задан —
    // отладочный режим) или авто-выпущенный через challenge→verify
    // подписью ключа входа в каталог из хранилища узла, с кэшем и
    // обновлением по истечении.
    authClient.interceptors.request.use(async (req) => {
      const jwt = tenantJwt ?? (await this.ensureTenantJwt());
      req.headers.Authorization = `Bearer ${jwt}`;
      return req;
    });
    return authClient;
  }

  /** Клиент оркестратора контура; без адреса install.js отдаётся напрямую из catalog-operator. */
  private createOrchestratorClient(): AxiosInstance | null {
    if (this.settings.orchestratorUrl) {
      return axios.create({ baseURL: this.settings.orchestratorUrl, timeout: 5000 });
    }
    this.logger.warn(
      'ORCHESTRATOR_URL не задан — install.js отдаётся напрямую из catalog-operator без фильтра установленности (degraded)',
    );
    return null;
  }

  /** Оркестратор получает токен сразу при старте, не дожидаясь первого такта. */
  onApplicationBootstrap(): void {
    void this.pushCatalogTokenToOrchestrator();
  }

  /**
   * Передать оркестратору tenant JWT каталога (Архитектура v5, 487-34).
   *
   * Оркестратор узнаёт подписки кооператива и скачивает пакеты из
   * catalog-delivery от имени кооператива. Ключа входа в каталог у него нет:
   * ключ живёт в хранилище ядра, и ядро отдаёт оркестратору только выпущенный
   * этим ключом токен с ограниченным сроком. Направление — от ядра к
   * оркестратору: токен не лежит на маршруте, который мог бы спросить любой
   * контейнер сети расширений.
   *
   * Сбой не роняет ядро: оркестратор доработает на прежнем токене, следующий
   * такт повторит передачу.
   */
  @Interval(ORCHESTRATOR_TOKEN_PUSH_MS) // timing: schedule — токен каталога живёт 30 минут
  async pushCatalogTokenToOrchestrator(): Promise<void> {
    if (!this.orchestratorClient || !this.settings.authUrl) return;
    try {
      const token = this.settings.tenantJwt ?? (await this.ensureTenantJwt());
      await this.orchestratorClient.put('/v1/internal/catalog/tenant-token', { token });
    }
    catch (err) {
      this.logger.warn(`tenant JWT каталога оркестратору не передан: ${failureOf(err).detail}`);
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
   * fallback на прямой catalog-operator путь (degraded dev-стенд).
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
   * Возвращает plain CJS-текст из catalog-operator endpoint'а
   * `GET /v1/public/packages/:scope/:name/install.js`. На degraded mode
   * (без env-config'а apps-catalog'а) либо если catalog-operator отвечает 404
   * — возвращает `null`, чтобы desktop'у было ясно «нет такого пакета /
   * каталог недоступен» вместо ошибки 500 в браузере.
   *
   * @param scope владелец пакета (`voskhod` из `@voskhod/demo-app`).
   * @param name  short-name пакета (`demo-app`).
   */
  /**
   * Story 9.3.b-pub: первичная регистрация пакета в каталоге.
   *
   * Прокидывает входной DTO на catalog-operator `POST /v1/admin/package`. catalog-operator
   * сам записывает пакет в базу каталога от имени chairman'а
   * кооператива-оператора каталога (voskhod на dev) — поэтому здесь не
   * требуется session-key пайщика.
   *
   * Discriminated outcome (vs. throw):
   *  - `applied` — HTTP 200, пакет записан;
   *  - `conflict` — HTTP 409 (пакет уже зарегистрирован или дубликат
   *    `request_id`); resolver мапит на `status: 'conflict'`;
   *  - `failed` — любое прочее (network, 400, 401, degraded-mode без
   *    APPS_CATALOG_OPERATOR_API_KEY); resolver мапит на `status: 'failed'`.
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
      const error = t('appsCatalogProxy.catalog.adminNotConfigured');
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
      const { status, detail } = failureOf(err);
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
   * Story 9.3.b-rel: создание нового релиза пакета в базе каталога.
   *
   * Прокидывает manifest + версию на catalog-operator `POST /v1/admin/releases`.
   * catalog-operator сам валидирует manifest Zod-схемой и записывает выпуск.
   *
   * Discriminated outcome:
   *  - `applied` — HTTP 200, выпуск записан; в payload может быть
   *    `transaction_id` (если адаптер не stub'овый);
   *  - `invalidManifest` — HTTP 422 INVALID_MANIFEST (manifest не прошёл
   *    Zod-валидацию на стороне catalog-operator); `error` содержит детали
   *    валидации в стабильном формате;
   *  - `failed` — прочие ошибки (network, 401, 503, degraded-mode).
   */
  async createRelease(input: CreateReleaseInput): Promise<CreateReleaseOutcome> {
    const requestId = input.requestId ?? uuidv4();
    if (!this.authClient) {
      const error = t('appsCatalogProxy.catalog.authNotConfigured');
      this.logger.warn(
        `createRelease refused (degraded mode): ${input.packageId}@${input.version}`,
      );
      return { status: 'failed', requestId, error };
    }
    try {
      const res = await this.authClient.post<{
        ok: boolean;
        outcome: 'queued' | 'activated';
        moderation_id: string;
      }>('/v1/releases', {
        request_id: requestId,
        package_id: input.packageId,
        version: input.version,
        ...(input.brief ? { brief: input.brief } : {}),
      });
      return {
        status: res.data.outcome === 'activated' ? 'applied' : 'queued',
        requestId,
        moderationId: res.data.moderation_id,
      };
    } catch (err) {
      const { status, detail } = failureOf(err);
      if (status === 404) {
        return { status: 'notPublished', requestId, error: detail };
      }
      if (status === 409) {
        return { status: 'conflict', requestId, error: detail };
      }
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
   * 487-27: список publisher-токенов кооператива (catalog-delivery
   * `GET /v1/publisher-tokens`, tenant-JWT). Degraded → пустой список.
   */
  async listPublisherTokens(
    filter: { username?: string; packageId?: string } = {},
  ): Promise<PublisherTokenWire[]> {
    if (!this.authClient) return [];
    const res = await this.authClient.get<{ items: PublisherTokenWire[] }>(
      '/v1/publisher-tokens',
      {
        params: {
          ...(filter.username ? { username: filter.username } : {}),
          ...(filter.packageId ? { package_id: filter.packageId } : {}),
        },
      },
    );
    return res.data.items;
  }

  /** 487-27: отозвать все ключи пайщика на пакет (снятие издателя). */
  async revokePublisherAccess(username: string, packageId: string): Promise<number> {
    if (!this.authClient) return 0;
    const res = await this.authClient.post<{ ok: boolean; revoked: number }>(
      '/v1/publisher-tokens/revoke-all',
      { username, package_id: packageId },
    );
    return res.data.revoked;
  }

  /**
   * 487-27: выдать publisher-токен пайщику. Plaintext возвращается
   * один раз — UI обязан показать его сразу.
   */
  async createPublisherToken(
    input: CreatePublisherTokenInput,
  ): Promise<CreatePublisherTokenOutcome> {
    if (!this.authClient) {
      return { status: 'failed', error: t('appsCatalogProxy.catalog.authNotConfigured') };
    }
    try {
      const res = await this.authClient.post<PublisherTokenWire & { token: string }>(
        '/v1/publisher-tokens',
        {
          username: input.username,
          package_id: input.packageId,
          label: input.label,
          created_by: input.createdBy,
          ...(input.expiresInDays ? { expires_in_days: input.expiresInDays } : {}),
        },
      );
      const { token, ...record } = res.data;
      return { status: 'created', token, record };
    } catch (err) {
      const { detail } = failureOf(err);
      this.logger.error(`createPublisherToken failed для ${input.username}: ${detail}`);
      return { status: 'failed', error: detail };
    }
  }

  /** 487-27: отозвать publisher-токен. `false` — не найден / уже отозван. */
  async revokePublisherToken(id: string): Promise<boolean> {
    if (!this.authClient) return false;
    try {
      await this.authClient.delete(`/v1/publisher-tokens/${encodeURIComponent(id)}`);
      return true;
    } catch (err) {
      if ((err as AxiosError).response?.status === 404) return false;
      throw err;
    }
  }

  /**
   * Story 9.9: список заявок на модерацию по статусу.
   *
   * Дёргает catalog-operator `GET /v1/admin/moderation?status=...&limit=...`.
   * Используется столом восхода (chairman voskhod) для просмотра pending
   * заявок и принятия решения (approve/reject).
   *
   * Degraded mode (нет catalog-operator client'а) → пустой массив, чтобы UI
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
   * Дёргает catalog-operator `POST /v1/admin/moderation/:id/approve`. catalog-operator
   * атомарно переводит moderation в APPROVED, активирует release и
   * выкладывает outbox-event `release.activated` (он же триггер для
   * записи выпуска в базе каталога и установки оркестратором).
   *
   * Discriminated outcome:
   *  - `applied` — HTTP 200, release ACTIVE, package_id/version в payload;
   *  - `pendingChain` — HTTP 423 APPROVED_PENDING_CHAIN: moderation
   *    одобрена, но запись выпуска не удалась;
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
      const error = t('appsCatalogProxy.catalog.adminNotConfigured');
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
      const { detail } = failureOf(err);
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
   * Дёргает catalog-operator `POST /v1/admin/moderation/:id/reject` с `reason`.
   * catalog-operator переводит moderation в REJECTED (compare-and-set из
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
      const error = t('appsCatalogProxy.catalog.adminNotConfigured');
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
      const { detail } = failureOf(err);
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
   * Вернуть валидный tenant JWT кооператива, выпустив новый при
   * необходимости: `POST /v1/auth/challenge` → подпись challenge-строки
   * ключом входа в каталог → `POST /v1/auth/verify`. Ключ выпускает и
   * публикует ядро (`<coop>@catalog`, CatalogKeyService), хранится он в
   * хранилище узла; каталог сверяет подпись с ключом этого разрешения в цепи
   * подсети кооператива. Транзакцию этим ключом не подписать.
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
    const signingKey = await this.vault.getWif(platformSettings().coopname, InnerKeyPermission.CATALOG);
    if (!signingKey) {
      throw new Error(t('appsCatalogProxy.catalog.noCooperativeKey'));
    }
    const base = this.settings.authUrl;
    const challengeRes = await axios.post<{ challenge_string?: string }>(
      `${base}/v1/auth/challenge`,
      { coopname: platformSettings().coopname },
      { timeout: 5000 },
    );
    const challenge = challengeRes.data?.challenge_string;
    if (typeof challenge !== 'string' || challenge.length === 0) {
      throw new Error(t('appsCatalogProxy.catalog.emptyChallenge'));
    }
    const signature = PrivateKey.from(signingKey).signMessage(Buffer.from(challenge)).toString();
    const verifyRes = await axios.post<{ token?: string }>(
      `${base}/v1/auth/verify`,
      { coopname: platformSettings().coopname, challenge_string: challenge, signature },
      { timeout: 5000 },
    );
    const token = verifyRes.data?.token;
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error(t('appsCatalogProxy.catalog.emptyToken'));
    }
    this.tenantJwt = token;
    this.tenantJwtExpMs = decodeJwtExpMs(token) ?? Date.now() + 5 * 60_000;
    this.logger.log(
      `tenant JWT обновлён (exp ${new Date(this.tenantJwtExpMs).toISOString()})`,
    );
    return token;
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
