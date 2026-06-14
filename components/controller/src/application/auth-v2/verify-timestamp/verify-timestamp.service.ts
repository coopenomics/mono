import { Inject, Injectable, Logger } from '@nestjs/common';
import { jwtVerify } from 'jose';
import config from '~/config/config';
import { REDIS_PORT } from '~/domain/common/ports/redis.port';
import type { RedisPort } from '~/domain/common/ports/redis.port';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { SESSION_METADATA_PORT } from '~/domain/auth-v2/ports/session-metadata.port';
import type { ISessionMetadataStore } from '~/domain/auth-v2/ports/session-metadata.port';
import { CHAIN_MANIFESTS_CACHE } from '~/domain/auth-v2/ports/chain-manifests-cache.port';
import type { IChainManifestsCache } from '~/domain/auth-v2/ports/chain-manifests-cache.port';
import { DegradedAuthReason } from '~/domain/auth-v2/degraded/degraded-auth.types';
import { isActivePermissionFinalized } from '~/domain/auth-v2/chain/chain-finality';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { AuditService } from '../audit/audit.service';
import { CertificateService } from '../certificate/certificate.service';
import { DeviceTrackingService } from '../device-tracking/device-tracking.service';

/** Окно свежести метки времени против head_block_time, сек (epic AC Story 1.7). */
const TIMESTAMP_WINDOW_SEC = 60;
/** Префикс Redis-ключа single-use jti (пишется в Story 1.6 при выпуске binding-токена). */
const BINDING_JTI_PREFIX = 'coopid:binding:';

export interface VerifyTimestampInput {
  signature: string;
  timestamp: string;
  bindingToken: string;
  ip?: string | null;
  userAgent?: string | null;
  acceptLanguage?: string | null;
}

export interface VerifyTimestampResult {
  access_token: string;
  refresh_token: string;
  /** participant_certificate (Story 1.8). Best-effort: при сбое выпуска вход не
   *  ломается — клиент дозапросит через GET /coop/certificate (там ошибка явная). */
  participant_certificate?: string;
  /** Degraded-вход (Story 4.5): ключ сверен против chain_manifests_cache, а не
   *  против живого COOPOS. Сигнал для UI/RP; присутствует только в degraded-режиме. */
  degraded?: boolean;
  degraded_reason?: DegradedAuthReason;
}

/** Псевдо-аккаунт для сверки ключа из кэша через blockchainPort.hasActiveKey. */
interface ActiveKeyAccount {
  permissions: Array<{ perm_name: string; required_auth: { keys: Array<{ key: string; weight: number }> } }>;
}

/** Время последнего изменения active-permission из аккаунта COOPOS (для finality, Story 9.6). */
function extractActiveLastUpdated(account: unknown): string | undefined {
  if (!account || typeof account !== 'object') return undefined;
  try {
    const json = JSON.parse(JSON.stringify(account)) as {
      permissions?: Array<{ perm_name?: string; last_updated?: string }>;
    };
    return json.permissions?.find((p) => p.perm_name === 'active')?.last_updated;
  } catch {
    return undefined;
  }
}

/** Собрать псевдо-аккаунт из кэшированных ключей для hasActiveKey (нормализация — в инфраструктуре). */
function manifestToAccount(keys: string[]): ActiveKeyAccount {
  return { permissions: [{ perm_name: 'active', required_auth: { keys: keys.map((key) => ({ key, weight: 1 })) } }] };
}

/**
 * Каноническое сообщение второго этапа auth — **зеркало**
 * `@coopenomics/auth.canonicalTimestampMessage` (Story 2.4). Ключи в фиксированном
 * алфавитном порядке: клиент (SDK) и сервер обязаны собрать байт-в-байт идентично,
 * иначе `recoverMessage` восстановит чужой pubkey. Зеркалим (а не импортируем ESM
 * SDK в CJS-контроллер) по той же конвенции, что `auth-v2.error.ts` зеркалит enum;
 * байт-идентичность держит общий golden-вектор в тестах обеих сторон.
 */
export function canonicalTimestampMessage(payload: { ts: string; binding_token_jti: string; sub: string }): string {
  return JSON.stringify({ binding_token_jti: payload.binding_token_jti, sub: payload.sub, ts: payload.ts });
}

/**
 * Второй этап двухэтапной аутентификации CoopID (Story 1.7): доказательство
 * владения приватным ключом. Проверяет подпись канонической метки времени против
 * публичного ключа аккаунта в COOPOS и завершает вход выпуском токенов.
 * `id_token`/`participant_certificate` — Story 1.8.
 */
@Injectable()
export class VerifyTimestampService {
  private readonly logger = new Logger(VerifyTimestampService.name);

  constructor(
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    private readonly tokens: TokenApplicationService,
    private readonly audit: AuditService,
    private readonly certificate: CertificateService,
    private readonly deviceTracking: DeviceTrackingService,
    @Inject(SESSION_METADATA_PORT) private readonly sessionMetadata: ISessionMetadataStore,
    @Inject(CHAIN_MANIFESTS_CACHE) private readonly chainManifests: IChainManifestsCache,
  ) {}

  async verify(input: VerifyTimestampInput): Promise<VerifyTimestampResult> {
    // 1. binding_token: подпись (HS256, shared secret 1.6) + exp + sub/jti.
    const secret = config.authV2.sessionBindingSecret;
    if (!secret) throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'AUTH_V2_SESSION_BINDING_SECRET не сконфигурирован');

    let sub: string;
    let jti: string;
    try {
      const { payload } = await jwtVerify(input.bindingToken, new TextEncoder().encode(secret));
      if (!payload.sub || !payload.jti) throw new Error('нет sub/jti');
      sub = payload.sub;
      jti = payload.jti;
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.SessionBindingExpired, 'session_binding_token недействителен или истёк');
    }

    // 2. single-use jti: потребляем ДО криптопроверки — токен «сгорает» при первой же
    //    попытке, нельзя перебирать подписи на одном binding-токене (anti-replay).
    const consumed = await this.redis.consumeSingleUse(`${BINDING_JTI_PREFIX}${jti}`);
    if (consumed === null) {
      await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: sub, result: 'failure', context: { reason: 'binding_reused' }, ip: input.ip });
      throw new AuthV2Error(AuthV2ErrorCode.SessionBindingReused, 'session_binding_token уже использован');
    }

    // 3. окно свежести метки против времени блокчейна (±60s). Полный get_info
    //    переиспользуем ниже для проверки финализации ключа (Story 9.6).
    let info: Awaited<ReturnType<BlockchainPort['getInfo']>>;
    try {
      info = await this.blockchainPort.getInfo();
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'COOPOS недоступен: не удалось получить время блокчейна');
    }
    const skewSec = Math.abs(new Date(info.head_block_time).getTime() - new Date(input.timestamp).getTime()) / 1000;
    if (!Number.isFinite(skewSec) || skewSec > TIMESTAMP_WINDOW_SEC) {
      await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: sub, result: 'failure', context: { reason: 'timestamp_window' }, ip: input.ip });
      throw new AuthV2Error(AuthV2ErrorCode.TimestampTooOld, 'Метка времени вне допустимого окна свежести');
    }

    // 4. восстановить pubkey из подписи по тому же каноническому сообщению, что подписал клиент.
    let recoveredKey: string;
    try {
      const message = canonicalTimestampMessage({ ts: input.timestamp, binding_token_jti: jti, sub });
      recoveredKey = this.blockchainPort.recoverPublicKey(message, input.signature);
    } catch {
      await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: sub, result: 'failure', context: { reason: 'signature_malformed' }, ip: input.ip });
      throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Не удалось восстановить ключ из подписи');
    }

    // 5. сверить восстановленный ключ с активными ключами аккаунта в COOPOS.
    //    Живой узел недоступен → degraded-фолбэк на chain_manifests_cache (Story 4.5).
    let degraded = false;
    let degradedReason: DegradedAuthReason | undefined;
    let liveAccount: Awaited<ReturnType<BlockchainPort['getAccount']>> = null;
    let liveReadOk = false;
    try {
      liveAccount = await this.blockchainPort.getAccount(sub);
      liveReadOk = true;
    } catch {
      liveReadOk = false;
    }

    // finalized-only gate (Story 9.6): живому head-снимку доверяем только если смена
    // active-permission уже необратима (last_updated не новее границы LIB). Иначе
    // (как и при недоступном узле) сверяем ключ против финализированного кэша.
    const liveFinalized =
      liveReadOk &&
      !!liveAccount &&
      isActivePermissionFinalized(extractActiveLastUpdated(liveAccount), info, {
        marginMs: config.blockchain.finalityMarginMs,
        blockIntervalMs: config.blockchain.blockIntervalMs,
      });

    if (liveReadOk && liveFinalized) {
      if (!liveAccount || !this.blockchainPort.hasActiveKey(liveAccount, recoveredKey)) {
        await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: sub, result: 'failure', context: { reason: 'key_mismatch' }, ip: input.ip });
        throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Подпись не соответствует ключу аккаунта');
      }
      // обновить снимок активных ключей с M-of-N консенсусом (Story 9.7); best-effort.
      await this.safeRefreshManifest(sub, input.ip);
    } else {
      // COOPOS down (RpcUnavailable) или ключ ещё не финализирован (KeyNotFinalized) →
      // сверка против последнего финализированного снимка chain_manifests_cache.
      const reason = liveReadOk ? DegradedAuthReason.KeyNotFinalized : DegradedAuthReason.RpcUnavailable;
      const manifest = await this.chainManifests.get(sub).catch(() => null);
      const cacheMatch =
        !!manifest && this.blockchainPort.hasActiveKey(manifestToAccount(manifest.active_keys), recoveredKey);
      if (!cacheMatch) {
        const failReason = liveReadOk ? 'key_not_finalized_no_cache' : 'coopos_down_no_cache';
        await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: sub, result: 'failure', context: { reason: failReason }, ip: input.ip });
        throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'COOPOS недоступен/не финализирован и нет валидного кеша ключей для проверки');
      }
      degraded = true;
      degradedReason = reason;
      await this.safeAudit({ event: 'coopid.auth.degraded', subjectId: sub, actor: sub, result: 'degraded', context: { reason: degradedReason }, ip: input.ip });
    }

    // успех → выпуск токенов платформенным механизмом (id_token/certificate — Story 1.8).
    const user = await this.userDomainService.getUserByUsername(sub);
    const pair = await this.tokens.generateAuthTokens(user.id);

    // participant_certificate (Story 1.8) — best-effort: сбой выпуска не валит логин.
    let participant_certificate: string | undefined;
    try {
      participant_certificate = await this.certificate.issueForUsername(sub);
    } catch (e) {
      this.logger.warn(`participant_certificate не выпущен на verify для ${sub}: ${e instanceof Error ? e.message : e}`);
    }

    await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: sub, actor: sub, result: 'success', ip: input.ip });

    // Device tracking (Story 3.8) — best-effort: сбой не валит выданный вход.
    try {
      await this.deviceTracking.recordLogin({
        subjectId: user.id,
        username: sub,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        acceptLanguage: input.acceptLanguage ?? null,
      });
    } catch (e) {
      this.logger.warn(`device tracking не записан на verify для ${sub}: ${e instanceof Error ? e.message : e}`);
    }

    // Метаданные сессии (Story 3.7) — best-effort: сбой side-store не валит выданный вход.
    // Привязаны к выпущенному refresh-токену → видны/отзываемы в «Активных сессиях».
    try {
      await this.sessionMetadata.record(pair.refresh.token, {
        ip: input.ip ?? null,
        device: input.userAgent ?? null,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.warn(`session metadata не записаны на verify для ${sub}: ${e instanceof Error ? e.message : e}`);
    }

    return {
      access_token: pair.access.token,
      refresh_token: pair.refresh.token,
      participant_certificate,
      ...(degraded ? { degraded: true, degraded_reason: degradedReason } : {}),
    };
  }

  /** Аудит не должен валить успешный вход (coop_domain_db недоступен → degraded-лог, не 500). */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch {
      // намеренно проглатываем: audit-инфраструктура отдельна от auth-критпути
    }
  }

  /**
   * Обновить снимок активных ключей в chain_manifests_cache с M-of-N консенсусом
   * (Story 9.7). При ≥2 расходящихся ответах RPC кэш НЕ обновляем (оставляем прошлое
   * валидное значение) и фиксируем инцидент `coopid.chain.divergent_rpc` — одна
   * скомпрометированная нода не подсунет в кэш фейковый ключ. Best-effort: сбой
   * обновления кэша не валит уже выданный (проверенный против живого узла) вход.
   */
  private async safeRefreshManifest(account: string, ip?: string | null): Promise<void> {
    try {
      const quorum = await this.blockchainPort.readActiveKeysQuorum(account);
      if (quorum.samples.length >= 2 && !quorum.agreed) {
        await this.safeAudit({
          event: 'coopid.chain.divergent_rpc',
          subjectId: account,
          result: 'failure',
          context: { reason: 'divergent_rpc_responses', samples: quorum.samples },
          ip,
        });
        return;
      }
      if (quorum.keys.length > 0) await this.chainManifests.put(account, quorum.keys);
    } catch (e) {
      this.logger.warn(`chain_manifests_cache не обновлён (quorum) для ${account}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
