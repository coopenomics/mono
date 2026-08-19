import { Inject, Injectable, Logger } from '@nestjs/common';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { AUTHENTIK_ADMIN_PORT } from '~/domain/auth-v2/ports/authentik-admin.port';
import type { IAuthentikAdminPort } from '~/domain/auth-v2/ports/authentik-admin.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { SecurityEventKind } from '~/domain/auth-v2/security-events/security-event.types';
import type {
  IRecoveryFinalization,
  RecoveryFinalizationInput,
} from '~/domain/auth-v2/ports/recovery-finalization.port';
import { AuditService } from '../audit/audit.service';
import { SecurityEventNotificationService } from '../security-events/security-event-notification.service';
import { SessionsService } from '../sessions/sessions.service';
import { VaultService } from '../vault/vault.service';

/**
 * Финализация восстановления доступа (CoopID, Story 3.3).
 *
 * Ротация ключа идёт УЖЕ проложенным путём — `registrator::changekey` (тот же, что
 * legacy `AuthInteractor.resetKey`): registrator является owner'ом аккаунтов пайщиков,
 * поэтому смена active-ключа активному пайщику кооператива — обычное действие
 * кооператива (подпись ключом `coopname` из vault). Отдельный authentik-путь для ключа
 * НЕ нужен.
 *
 * Новый пароль authentik записывается здесь же (Story 12.1) через admin set_password —
 * раньше пароль молча игнорировался, из-за чего после восстановления пайщик оставался
 * залочен (vault уже под новым паролём, authentik помнил старый). authentik —
 * единственный store паролей; пароль прозрачно уходит туда и НЕ логируется/НЕ хранится
 * на стороне controller'а.
 *
 * Порядок записей (setPassword → vault → changekey) выбран по матрице частичных сбоев
 * трёх независимых хранилищ (authentik / vault-БД / on-chain). Запись во внешний IdP —
 * самый вероятный отказ (недоступность, политика пароля), поэтому она ИДЁТ ПЕРВОЙ: её
 * сбой не трогает ни vault, ни цепь → пайщик остаётся на старых кредах и чисто повторяет
 * восстановление. vault — ДО changekey (новый приватный ключ живёт только в блобе, on-chain
 * переключение коммитит его последним и ретраится при сбое).
 *
 * Мультисиг для recovery не требуется: self-recovery подтверждён факторами самого
 * пайщика (magic-link + TOTP). Защита от единоличного захвата нужна только для
 * force-recovery — она живёт в `ForceRecoveryService` (Story 6.9), не здесь.
 */
@Injectable()
export class RecoveryFinalizationService implements IRecoveryFinalization {
  private readonly logger = new Logger(RecoveryFinalizationService.name);

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly chain: BlockchainPort,
    @Inject(AUTHENTIK_ADMIN_PORT) private readonly authentikAdmin: IAuthentikAdminPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    private readonly vault: VaultService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly securityEvents: SecurityEventNotificationService,
  ) {}

  async finalize(input: RecoveryFinalizationInput): Promise<void> {
    const trigger = input.trigger ?? 'recovery';
    const ip = input.ip ?? null;

    // 0. Старый active-ключ — для аудита (best-effort: чтение не блокирует ротацию).
    const oldPublicKey = await this.readActiveKey(input.username);

    // 1. Новый пароль в authentik — ПЕРВЫМ (Story 12.1). Запись во внешний IdP — самый
    //    вероятный сбой; если падает здесь, vault и цепь ещё не тронуты → откат на старые
    //    креды, чистый повтор восстановления (см. JSDoc про порядок). Пароль не логируется.
    //
    //    Учётки может ещё НЕ БЫТЬ: пайщик легаси-контура (вход по ключу, пароль не
    //    задавал) вправе включить TOTP из настроек — TOTP хранится у controller'а,
    //    а не в authentik, поэтому «TOTP есть ⇒ учётка есть» не выполняется. Для
    //    такого пайщика восстановление и есть переход на пароль — заводим учётку
    //    тем же ensureUser, что и миграция (email — из его пользовательской записи).
    let userPk = await this.authentikAdmin.findUserPk(input.username);
    if (userPk === null) {
      const user = await this.users.getUserByUsername(input.username);
      userPk = await this.authentikAdmin.ensureUser({ username: input.username, email: user.email, name: input.username });
    }
    await this.authentikAdmin.setPassword(userPk, input.newPassword);

    // 2. Новый зашифрованный блоб — ДО on-chain переключения: новый приватный ключ
    //    существует только в нём. Если changekey упадёт после — ключ не потерян, ротация
    //    ретраится. Обратный порядок (changekey раньше vault) при сбое vault залочил бы пайщика.
    await this.vault.store(
      { subject_type: 'participant', subject_id: input.username },
      input.vaultBlob,
    );

    // 3. Ротация active-ключа через registrator::changekey (подпись ключом кооператива).
    await this.chain.changeKey({
      coopname: input.coopname,
      changer: input.coopname,
      username: input.username,
      public_key: input.newPublicKey,
    });

    // 4. Отозвать все старые сессии — доступ по старому ключу прекращается.
    const { revoked } = await this.sessions.revokeAll(input.subjectId, ip);

    // 5. Аудит ротации (Story 8.4). pubkey'и публичны — не секрет.
    await this.audit.record({
      event: 'KeyRotated',
      subjectId: input.subjectId,
      actor: trigger === 'force_recovery' ? 'chairman' : 'self',
      result: 'success',
      ip,
      context: {
        trigger,
        old_pubkey: oldPublicKey,
        new_pubkey: input.newPublicKey,
        initiator_id: input.subjectId,
        sessions_revoked: revoked,
      },
    });

    // 6. Уведомить пайщика о перевыпуске ключа (детекция чужой ротации). best-effort.
    await this.securityEvents.notify({
      subjectId: input.subjectId,
      kind: SecurityEventKind.KeyRotated,
      ip,
    });

    this.logger.log(
      `recovery.finalize: ключ ротирован для subject=${input.subjectId} (${trigger}), сессий отозвано=${revoked}`,
    );
  }

  /** Старый active-ключ из COOPOS (best-effort: только для аудита, сбой не критичен). */
  private async readActiveKey(username: string): Promise<string | null> {
    try {
      const account = await this.chain.getAccount(username);
      const active = account?.permissions?.find((p) => p.perm_name === 'active');
      return active?.required_auth?.keys?.[0]?.key ?? null;
    } catch {
      return null;
    }
  }
}
