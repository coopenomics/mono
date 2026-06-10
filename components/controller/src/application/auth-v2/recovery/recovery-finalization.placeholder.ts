import { Injectable, Logger } from '@nestjs/common';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import type {
  IRecoveryFinalization,
  RecoveryFinalizationInput,
} from '~/domain/auth-v2/ports/recovery-finalization.port';

/**
 * Временная реализация порта финализации (CoopID, Story 3.2 → сейм Story 3.3).
 *
 * Двухканальное подтверждение (magic-link + TOTP) и оркестрация — рабочие и
 * покрыты тестами уже в 3.2. Сама ротация ключа (COOPOS `updateauth` через
 * service-account + установка пароля в authentik + запись vault-блоба + отзыв
 * сессий) приходит Story 3.3 и имеет внешние зависимости (в т.ч. источник
 * admin-токена authentik — открытый вопрос владельцу). До неё confirm проходит
 * валидацию и предсказуемо отвечает 503 — частичная финализация запрещена
 * (рассинхрон ключа блокирует пайщика).
 *
 * Story 3.3 заменяет привязку `RECOVERY_FINALIZATION_PORT` на боевую реализацию.
 */
@Injectable()
export class RecoveryFinalizationPlaceholder implements IRecoveryFinalization {
  private readonly logger = new Logger(RecoveryFinalizationPlaceholder.name);

  async finalize(input: RecoveryFinalizationInput): Promise<void> {
    // Секреты не логируем — только факт обращения и субъект.
    this.logger.warn(
      `recovery.finalize запрошена для subject=${input.subjectId}, но ротация ключа подключается в Story 3.3`,
    );
    throw new AuthV2Error(
      AuthV2ErrorCode.CooposDegraded,
      'Завершение восстановления временно недоступно: ротация ключа подключается в ближайшем обновлении.',
    );
  }
}
