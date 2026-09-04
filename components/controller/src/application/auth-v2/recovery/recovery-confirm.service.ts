import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { RECOVERY_TOKEN_STORE } from '~/domain/auth-v2/ports/recovery-token-store.port';
import type { IRecoveryTokenStore } from '~/domain/auth-v2/ports/recovery-token-store.port';
import { TWO_FACTOR_VERIFIER } from '~/domain/auth-v2/ports/two-factor.port';
import type { ITwoFactorVerifier } from '~/domain/auth-v2/ports/two-factor.port';
import { RECOVERY_FINALIZATION_PORT } from '~/domain/auth-v2/ports/recovery-finalization.port';
import type { IRecoveryFinalization } from '~/domain/auth-v2/ports/recovery-finalization.port';
import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';
import { AuditService } from '../audit/audit.service';
import { passwordPolicyErrors } from '../password-policy';

/** Вход confirm: токен magic-link + второй фактор (TOTP) + новый ключевой материал. */
export interface RecoveryConfirmInput {
  token: string;
  /** TOTP-код из приложения-аутентификатора (второй канал, Story 3.6). Не нужен, если 2FA не подключён. */
  code?: string;
  /** Новый публичный ключ пайщика — для COOPOS updateauth (финализация Story 3.3). */
  newPublicKey: string;
  /** Новый зашифрованный vault-блоб (собран на клиенте под новым паролем). */
  vaultBlob: EncryptedVaultBlob;
  /** Новый пароль — для authentik. Только в памяти запроса, не сохраняется. */
  newPassword: string;
}

/**
 * Двухканальное подтверждение восстановления доступа (CoopID, Story 3.2).
 *
 * Решение владельца (2026-06-10): второй канал = TOTP (Story 3.6), пароль на
 * финальном шаге и не хранится. Поэтому recovery статeless — единственное
 * хранимое состояние — короткоживущий magic-link токен (Story 3.1).
 *
 * Порядок: `peek` токена (без потребления — неверный TOTP не сжигает ссылку) →
 * проверка второго фактора → атомарный `consume` (claim перед финализацией,
 * защита от двойного использования) → передача материала в порт финализации
 * (`RECOVERY_FINALIZATION_PORT`, ротация ключа = сейм Story 3.3) → audit.
 */
@Injectable()
export class RecoveryConfirmService {
  private readonly logger = new Logger(RecoveryConfirmService.name);

  constructor(
    @Inject(RECOVERY_TOKEN_STORE) private readonly tokenStore: IRecoveryTokenStore,
    @Inject(TWO_FACTOR_VERIFIER) private readonly twoFactor: ITwoFactorVerifier,
    @Inject(RECOVERY_FINALIZATION_PORT) private readonly finalization: IRecoveryFinalization,
    private readonly audit: AuditService,
  ) {}

  /**
   * Подтвердить смену ключа: проверить оба канала и запустить финализацию.
   *
   * Возвращает `{ username }` пайщика, резолвнутый из recovery-токена. Клиент
   * шифрует новый vault ещё ДО этого вызова (одним запросом несёт блоб в теле),
   * поэтому account на тот момент ему неизвестен и в AAD не закладывается; зато
   * для повторного входа после смены ключа (скачать блоб по account, расшифровать)
   * username нужен — его и отдаём здесь, без отдельного whoami-by-token эндпоинта.
   */
  async confirm(input: RecoveryConfirmInput, ip: string | null): Promise<{ username: string }> {
    // 0. Парольная политика — ДО потребления токена: слабый пароль не сжигает ссылку.
    const policyErrors = passwordPolicyErrors(input.newPassword ?? '');
    if (policyErrors.length > 0)
      throw new AuthV2Error(AuthV2ErrorCode.WeakPassword, `Пароль слишком простой: ${policyErrors.join(', ').toLowerCase()}`);

    // 1. Неразрушающее чтение: кому принадлежит токен (без потребления).
    const payload = await this.tokenStore.peek(input.token);
    if (!payload) throw this.invalidToken();

    // 2. Второй фактор — только если пайщик его подключал (решение владельца 03.09.2026).
    //    До этого TOTP требовался безусловно, и восстановление было мертво у всех, кто
    //    2FA не заводил: экран просил код, которого у человека нет и быть не может, а
    //    оба входных канала (magic-link 3.1 и offline-код 3.4) сходятся сюда же. У кого
    //    2FA есть — контур прежний, два независимых канала; у кого нет — ссылка из почты
    //    остаётся единственным фактором, как в обычном сбросе пароля.
    const enabled = await this.twoFactor.isEnabled(payload.subjectId);
    if (enabled) {
      const codeOk = await this.twoFactor.verify(payload.subjectId, input.code ?? '');
      if (!codeOk) {
        throw new AuthV2Error(
          AuthV2ErrorCode.InvalidTwoFactorCode,
          'Неверный код из приложения-аутентификатора.',
        );
      }
    }
    // Чем подтверждено — пишем в audit ниже: 'totp' либо 'none' (только magic-link).
    const secondFactor = enabled ? 'totp' : 'none';

    // 3. Claim токена (атомарный single-use) — только после успешной проверки.
    //    Если параллельный confirm уже потребил — null → токен невалиден.
    const claimed = await this.tokenStore.consume(input.token);
    if (!claimed) throw this.invalidToken();

    // 4. Финализация (ротация ключа + пароль + vault + отзыв сессий) — Story 3.3.
    try {
      await this.finalization.finalize({
        subjectId: claimed.subjectId,
        username: claimed.username,
        coopname: claimed.coopname,
        newPublicKey: input.newPublicKey,
        vaultBlob: input.vaultBlob,
        newPassword: input.newPassword,
        ip,
      });
    } catch (err) {
      // Контекст без секретов: ни пароля, ни ключа, ни кода, ни токена.
      await this.audit.record({
        event: 'coopid.recovery.confirmed',
        subjectId: claimed.subjectId,
        actor: 'self',
        result: 'failure',
        context: { strategy: 'email_magic_link', second_factor: secondFactor },
        ip,
      });
      throw err;
    }

    await this.audit.record({
      event: 'coopid.recovery.confirmed',
      subjectId: claimed.subjectId,
      actor: 'self',
      result: 'success',
      context: { strategy: 'email_magic_link', second_factor: secondFactor },
      ip,
    });

    return { username: claimed.username };
  }

  /**
   * Отмена восстановления («это не я» / случайное письмо): сжечь magic-link токен,
   * чтобы по нему нельзя было сменить ключ. Пароль не менялся (его и не было).
   */
  async cancel(token: string, ip: string | null): Promise<void> {
    const payload = await this.tokenStore.consume(token);
    if (!payload) throw this.invalidToken();
    await this.audit.record({
      event: 'coopid.recovery.cancelled',
      subjectId: payload.subjectId,
      actor: 'self',
      result: 'success',
      context: { strategy: 'email_magic_link' },
      ip,
    });
  }

  private invalidToken(): AuthV2Error {
    return new AuthV2Error(
      AuthV2ErrorCode.InvalidRecoveryToken,
      'Ссылка восстановления недействительна или истекла. Запросите восстановление заново.',
    );
  }
}
