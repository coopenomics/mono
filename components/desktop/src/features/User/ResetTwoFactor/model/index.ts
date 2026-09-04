import { ref } from 'vue';
import type { Queries } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { api } from '../api';

/** Состояние подтверждения входа у пайщика — тип из SDK end-to-end. */
export type IParticipantLoginSecurity =
  Queries.AccountSecurity.GetParticipantLoginSecurity.IOutput[typeof Queries.AccountSecurity.GetParticipantLoginSecurity.name];

/**
 * Сброс приложения-аутентификатора у пайщика председателем совета.
 *
 * Пайщик, потерявший телефон, снять фактор сам не может: отключение требует
 * действующий код, а взять его негде — ровно поэтому он и идёт к председателю.
 * Полномочия проверяет сервер; здесь только состояние экрана.
 */
export function useResetTwoFactor() {
  const loading = ref(false);
  const security = ref<IParticipantLoginSecurity | null>(null);

  async function load(username: string): Promise<void> {
    try {
      security.value = await api.loadParticipantSecurity(username);
    } catch {
      // Молча: отсутствие данных о факторе не должно ломать карточку пайщика —
      // просто не покажем блок.
      security.value = null;
    }
  }

  async function reset(username: string): Promise<boolean> {
    try {
      loading.value = true;
      const wasReset = await api.resetParticipantTwoFactor(username);
      SuccessAlert(
        wasReset
          ? 'Приложение-аутентификатор снято. Пайщик войдёт по паролю и подключит его заново'
          : 'У пайщика приложение-аутентификатор не подключено',
      );
      await load(username);
      return wasReset;
    } catch (error: any) {
      FailAlert(error);
      return false;
    } finally {
      loading.value = false;
    }
  }

  return { loading, security, load, reset };
}
