import { Inject, Injectable, Logger } from '@nestjs/common';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
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
 * НЕ нужен. Пароль authentik в recovery — Эпик 5 (контроллер пока не пишет в authentik).
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

    // 1. Новый зашифрованный блоб — ПЕРВЫМ: новый приватный ключ существует только в нём.
    //    Если on-chain переключение упадёт после — ключ не потерян, ротация ретраится.
    //    Обратный порядок (changekey раньше vault) при сбое vault залочил бы пайщика.
    await this.vault.store(
      { subject_type: 'participant', subject_id: input.username },
      input.vaultBlob,
    );

    // 2. Ротация active-ключа через registrator::changekey (подпись ключом кооператива).
    await this.chain.changeKey({
      coopname: input.coopname,
      changer: input.coopname,
      username: input.username,
      public_key: input.newPublicKey,
    });

    // 3. Отозвать все старые сессии — доступ по старому ключу прекращается.
    const { revoked } = await this.sessions.revokeAll(input.subjectId, ip);

    // 4. Аудит ротации (Story 8.4). pubkey'и публичны — не секрет.
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

    // 5. Уведомить пайщика о перевыпуске ключа (детекция чужой ротации). best-effort.
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
