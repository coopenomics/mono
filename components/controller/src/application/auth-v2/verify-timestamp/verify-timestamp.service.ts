import { Inject, Injectable, Logger } from '@nestjs/common';
import { jwtVerify } from 'jose';
import config from '~/config/config';
import { REDIS_PORT } from '~/domain/common/ports/redis.port';
import type { RedisPort } from '~/domain/common/ports/redis.port';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { AuditService } from '../audit/audit.service';
import { CertificateService } from '../certificate/certificate.service';

/** Окно свежести метки времени против head_block_time, сек (epic AC Story 1.7). */
const TIMESTAMP_WINDOW_SEC = 60;
/** Префикс Redis-ключа single-use jti (пишется в Story 1.6 при выпуске binding-токена). */
const BINDING_JTI_PREFIX = 'coopid:binding:';

export interface VerifyTimestampInput {
  signature: string;
  timestamp: string;
  bindingToken: string;
  ip?: string | null;
}

export interface VerifyTimestampResult {
  access_token: string;
  refresh_token: string;
  /** participant_certificate (Story 1.8). Best-effort: при сбое выпуска вход не
   *  ломается — клиент дозапросит через GET /coop/certificate (там ошибка явная). */
  participant_certificate?: string;
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

    // 3. окно свежести метки против времени блокчейна (±60s).
    let headBlockTime: string;
    try {
      headBlockTime = (await this.blockchainPort.getInfo()).head_block_time;
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'COOPOS недоступен: не удалось получить время блокчейна');
    }
    const skewSec = Math.abs(new Date(headBlockTime).getTime() - new Date(input.timestamp).getTime()) / 1000;
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
    let account: Awaited<ReturnType<BlockchainPort['getAccount']>>;
    try {
      account = await this.blockchainPort.getAccount(sub);
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'COOPOS недоступен: не удалось получить аккаунт');
    }
    if (!account || !this.blockchainPort.hasActiveKey(account, recoveredKey)) {
      await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: sub, result: 'failure', context: { reason: 'key_mismatch' }, ip: input.ip });
      throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Подпись не соответствует ключу аккаунта');
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

    return { access_token: pair.access.token, refresh_token: pair.refresh.token, participant_certificate };
  }

  /** Аудит не должен валить успешный вход (coop_domain_db недоступен → degraded-лог, не 500). */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch {
      // намеренно проглатываем: audit-инфраструктура отдельна от auth-критпути
    }
  }
}
