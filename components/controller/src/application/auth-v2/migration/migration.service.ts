import { createHash } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { AUTHENTIK_ADMIN_PORT } from '~/domain/auth-v2/ports/authentik-admin.port';
import type { IAuthentikAdminPort } from '~/domain/auth-v2/ports/authentik-admin.port';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { AuditService } from '../audit/audit.service';

/** Окно свежести метки времени против head_block_time, сек. */
const TIMESTAMP_WINDOW_SEC = 60;
/** Минимальная длина пароля (нижняя планка; энтропия/zxcvbn — на стороне authentik, FR58 MVP). */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Каноническое сообщение proof'а миграции «ключ→пароль» — **зеркало**
 * `@coopenomics/auth.canonicalMigrationMessage` (Story 11.4). Клиент подписывает
 * это сообщение приватным ключом, сервер собирает его байт-в-байт и через
 * `recoverPublicKey` восстанавливает pubkey. Ключи в фиксированном алфавитном
 * порядке (детерминизм клиент↔сервер, как у `canonicalTimestampMessage`).
 *
 * `pw_hash` (sha256-hex нового пароля) биндит подпись к конкретному паролю:
 * перехваченный proof нельзя переиспользовать с ДРУГИМ паролём (подмена пароля при
 * replay не пройдёт — пересобранное сообщение даст другой pubkey). `purpose` —
 * защита от кросс-протокольного replay (proof логина ≠ proof миграции).
 */
export function canonicalMigrationMessage(payload: { ts: string; pw_hash: string }): string {
  return JSON.stringify({ pw_hash: payload.pw_hash, purpose: 'coopid-key-migration', ts: payload.ts });
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface MigrateInput {
  email: string;
  timestamp: string;
  signature: string;
  newPassword: string;
  ip?: string | null;
}

/**
 * Миграция действующего пайщика «ключ → пароль» (Story 11.4). Пайщик ещё БЕЗ
 * пароля → сессию authentik установить не может, поэтому владение доказывается
 * НЕ через session-bind, а напрямую подписью метки времени против он-чейн
 * active-permission (как легаси `login(email, now, signature)`). При успехе —
 * provisioning учётки authentik и установка пароля (Story 11.1). Шифрование
 * текущего WIF в vault новым паролём делает клиент (SDK `migrate` → `saveToVault`,
 * Story 11.3) — приватный ключ на сервер не уходит.
 *
 * Идемпотентно: `ensureUser` возвращает существующий pk, `setPassword`
 * перезаписывает — повторный вызов с тем же ключом/паролём безопасен.
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(AUTHENTIK_ADMIN_PORT) private readonly authentikAdmin: IAuthentikAdminPort,
    private readonly audit: AuditService,
  ) {}

  async migrate(input: MigrateInput): Promise<void> {
    if (!input.newPassword || input.newPassword.length < MIN_PASSWORD_LENGTH)
      throw new AuthV2Error(AuthV2ErrorCode.WeakPassword, `Пароль слишком короткий: минимум ${MIN_PASSWORD_LENGTH} символов`);

    // 1. email → пайщик. Несуществующий email и неверный ключ дают ОДНУ ошибку
    //    (InvalidCredentials) — без enumeration существования аккаунта.
    const user = await this.userDomainService.getUserByEmail(input.email).catch(() => null);
    if (!user)
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Неверный email, ключ или подпись');

    // 2. окно свежести метки против времени блокчейна (anti-replay вне ±60s).
    let info: Awaited<ReturnType<BlockchainPort['getInfo']>>;
    try {
      info = await this.blockchainPort.getInfo();
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'COOPOS недоступен: не удалось получить время блокчейна');
    }
    const skewSec = Math.abs(new Date(info.head_block_time).getTime() - new Date(input.timestamp).getTime()) / 1000;
    if (!Number.isFinite(skewSec) || skewSec > TIMESTAMP_WINDOW_SEC)
      throw new AuthV2Error(AuthV2ErrorCode.TimestampTooOld, 'Метка времени вне допустимого окна свежести');

    // 3. восстановить pubkey из подписи по каноническому сообщению (ts + pw_hash).
    let recoveredKey: string;
    try {
      const message = canonicalMigrationMessage({ ts: input.timestamp, pw_hash: sha256Hex(input.newPassword) });
      recoveredKey = this.blockchainPort.recoverPublicKey(message, input.signature);
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Неверный email, ключ или подпись');
    }

    // 4. сверить ключ с активными ключами аккаунта в COOPOS (живой узел — миграция
    //    security-критична, degraded-кэш не принимаем: при недоступном узле просим повторить).
    let account: Awaited<ReturnType<BlockchainPort['getAccount']>>;
    try {
      account = await this.blockchainPort.getAccount(user.username);
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'COOPOS недоступен: не удалось проверить ключ аккаунта');
    }
    if (!account || !this.blockchainPort.hasActiveKey(account, recoveredKey)) {
      await this.safeAudit({ event: 'coopid.migrate', subjectId: user.username, result: 'failure', context: { reason: 'key_mismatch' }, ip: input.ip });
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Неверный email, ключ или подпись');
    }

    // 5. provisioning authentik + установка пароля (Story 11.1). Пароль прозрачно
    //    уходит в authentik (единственный store паролей) и не логируется здесь.
    const userPk = await this.authentikAdmin.ensureUser({ username: user.username, email: input.email, name: user.username });
    await this.authentikAdmin.setPassword(userPk, input.newPassword);

    await this.safeAudit({ event: 'coopid.migrate', subjectId: user.username, actor: user.username, result: 'success', ip: input.ip });
  }

  /** Аудит best-effort: недоступность audit-инфраструктуры не валит успешную миграцию. */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch (e) {
      this.logger.warn(`audit миграции не записан: ${e instanceof Error ? e.message : e}`);
    }
  }
}
