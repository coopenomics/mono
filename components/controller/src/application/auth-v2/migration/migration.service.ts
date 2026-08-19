import { createHash } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import config from '~/config/config';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { AUTHENTIK_ADMIN_PORT } from '~/domain/auth-v2/ports/authentik-admin.port';
import type { IAuthentikAdminPort } from '~/domain/auth-v2/ports/authentik-admin.port';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';
import { AuditService } from '../audit/audit.service';
import { passwordPolicyErrors } from '../password-policy';
import { SessionsService } from '../sessions/sessions.service';
import { VaultService } from '../vault/vault.service';

/** Окно свежести метки времени против head_block_time, сек. */
const TIMESTAMP_WINDOW_SEC = 60;

/**
 * Каноническое сообщение proof'а миграции «ключ→пароль» — **зеркало**
 * `@coopenomics/auth.canonicalMigrationMessage` (Story 11.4). Клиент подписывает
 * это сообщение приватным ключом, сервер собирает его байт-в-байт и через
 * `recoverPublicKey` восстанавливает pubkey.
 *
 * `pw_hash` (sha256-hex нового пароля) биндит подпись к конкретному паролю,
 * `pk` (новый публичный ключ, только при ротации) — к конкретной замене ключа:
 * перехваченный proof нельзя переиспользовать ни с другим паролём, ни с
 * подменённым ключом (пересобранное сообщение даст другой pubkey). `purpose` —
 * защита от кросс-протокольного replay (proof логина ≠ proof миграции).
 * Без ротации `pk` в сообщении отсутствует — формат старых клиентов не тронут.
 */
export function canonicalMigrationMessage(payload: { ts: string; pw_hash: string; pk?: string }): string {
  if (payload.pk)
    return JSON.stringify({ pk: payload.pk, purpose: 'coopid-key-migration', pw_hash: payload.pw_hash, ts: payload.ts });
  return JSON.stringify({ pw_hash: payload.pw_hash, purpose: 'coopid-key-migration', ts: payload.ts });
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Псевдо-аккаунт: сверка одиночного ключа через blockchainPort.hasActiveKey (нормализация — в инфраструктуре). */
function keyToAccount(key: string) {
  return { permissions: [{ perm_name: 'active', required_auth: { keys: [{ key, weight: 1 }] } }] };
}

export interface MigrateInput {
  email: string;
  timestamp: string;
  signature: string;
  newPassword: string;
  /** Новый публичный ключ — запрос ротации (генерится клиентом, приватный — только в vault-блобе). */
  newPublicKey?: string | null;
  /** Зашифрованный паролём блоб с НОВЫМ приватным ключом (обязателен при ротации). */
  vaultBlob?: EncryptedVaultBlob | null;
  ip?: string | null;
}

export interface MigrateOutcome {
  username: string;
  /** Ключ ротирован on-chain (клиент сверяет: без подтверждения vault и цепь разошлись бы). */
  rotated: boolean;
}

/**
 * Миграция действующего пайщика «ключ → пароль» (Story 11.4). Пайщик ещё БЕЗ
 * пароля → сессию authentik установить не может, поэтому владение доказывается
 * НЕ через session-bind, а напрямую подписью метки времени против он-чейн
 * active-permission (как легаси `login(email, now, signature)`). При успехе —
 * provisioning учётки authentik и установка пароля (Story 11.1).
 *
 * РОТАЦИЯ (принятый пайщик, `newPublicKey` в запросе): старый ключ, которым
 * пайщик пользовался до пароля, хранился «хрен поймёшь где» — после перехода на
 * пароль он обязан умереть, иначе им можно войти и сменить пароль. Порядок
 * записей — как у recovery-finalization (см. её JSDoc про матрицу сбоев):
 * setPassword (внешний IdP — самый вероятный отказ, идёт первым) → vault (новый
 * приватный ключ существует только в блобе — сначала укрытие) → changekey
 * (`registrator::changekey`, подпись кооператива) → отзыв старых сессий.
 *
 * КАНДИДАТ (`is_registered=false`): аккаунта в цепи ещё нет — владение
 * доказывается против `user.public_key` из БД (тот же приём, что в легаси
 * `loginUserWithSignature`), ротация невозможна (`changekey` требует принятого
 * пайщика) и не нужна (режим регистрации: ключ никому не показывался). Запрос
 * ротации кандидатом → `RotationUnavailable`, клиент повторяет без неё.
 *
 * Идемпотентно без ротации: `ensureUser` возвращает существующий pk, `setPassword`
 * перезаписывает. С ротацией повтор невозможен по построению — старый ключ мёртв.
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(AUTHENTIK_ADMIN_PORT) private readonly authentikAdmin: IAuthentikAdminPort,
    private readonly vault: VaultService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async migrate(input: MigrateInput): Promise<MigrateOutcome> {
    const policyErrors = passwordPolicyErrors(input.newPassword ?? '');
    if (policyErrors.length > 0)
      throw new AuthV2Error(AuthV2ErrorCode.WeakPassword, `Пароль слишком простой: ${policyErrors.join(', ').toLowerCase()}`);

    const rotate = !!input.newPublicKey;
    if (rotate && !input.vaultBlob)
      throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Ротация без vault-блоба невозможна: новому ключу негде жить');

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

    // 3. восстановить pubkey из подписи по каноническому сообщению (ts + pw_hash [+ pk]).
    let recoveredKey: string;
    try {
      const message = canonicalMigrationMessage({
        ts: input.timestamp,
        pw_hash: sha256Hex(input.newPassword),
        ...(rotate ? { pk: input.newPublicKey as string } : {}),
      });
      recoveredKey = this.blockchainPort.recoverPublicKey(message, input.signature);
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Неверный email, ключ или подпись');
    }

    // 4. сверить ключ с владением. Принятый пайщик — активные ключи аккаунта в COOPOS
    //    (живой узел — миграция security-критична, degraded-кэш не принимаем: при
    //    недоступном узле просим повторить). Кандидат — `public_key` из его учётки:
    //    аккаунта в цепи ещё нет, ключ зафиксирован при регистрации (паттерн легаси-входа).
    let oldPublicKey: string | null = null;
    if (user.is_registered) {
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
      oldPublicKey = recoveredKey;
    } else {
      if (rotate)
        throw new AuthV2Error(AuthV2ErrorCode.RotationUnavailable, 'Смена ключа доступна после завершения регистрации');
      if (!user.public_key || !this.blockchainPort.hasActiveKey(keyToAccount(user.public_key), recoveredKey)) {
        await this.safeAudit({ event: 'coopid.migrate', subjectId: user.username, result: 'failure', context: { reason: 'candidate_key_mismatch' }, ip: input.ip });
        throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Неверный email, ключ или подпись');
      }
    }

    // 5. provisioning authentik + установка пароля (Story 11.1). Пароль прозрачно
    //    уходит в authentik (единственный store паролей) и не логируется здесь.
    const userPk = await this.authentikAdmin.ensureUser({ username: user.username, email: input.email, name: user.username });
    await this.authentikAdmin.setPassword(userPk, input.newPassword);

    if (rotate) {
      // 6. блоб с НОВЫМ ключом — ДО changekey: новый приватный ключ существует только
      //    в нём; если переключение упадёт, старый ключ ещё жив и миграция ретраится.
      await this.vault.store({ subject_type: 'participant', subject_id: user.username }, input.vaultBlob as EncryptedVaultBlob);

      // 7. ротация active-ключа тем же путём, что recovery (`registrator::changekey`,
      //    подпись кооператива) — старый ключ с этого момента мёртв.
      await this.blockchainPort.changeKey({
        coopname: config.coopname,
        changer: config.coopname,
        username: user.username,
        public_key: input.newPublicKey as string,
      });

      // 8. отозвать старые сессии — доступ, полученный старым ключом, прекращается.
      const { revoked } = await this.sessions.revokeAll(user.id, input.ip ?? null);

      await this.safeAudit({
        event: 'KeyRotated',
        subjectId: user.username,
        actor: user.username,
        result: 'success',
        ip: input.ip,
        context: { trigger: 'migration', old_pubkey: oldPublicKey, new_pubkey: input.newPublicKey, sessions_revoked: revoked },
      });
    }

    await this.safeAudit({ event: 'coopid.migrate', subjectId: user.username, actor: user.username, result: 'success', context: { rotated: rotate }, ip: input.ip });

    // username нужен клиенту как subject_id vault'а. Отдаём только после
    // доказанного владения ключом — enumeration по email невозможен.
    return { username: user.username, rotated: rotate };
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
