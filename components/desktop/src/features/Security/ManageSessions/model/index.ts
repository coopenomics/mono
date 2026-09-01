import { ref } from 'vue';
import type { Mutations, Queries } from '@coopenomics/sdk';
import { api } from '../api';

/** Вход на завершение конкретной сессии (из SDK, не переописываем). */
export type IRevokeSessionInput = Mutations.AccountSecurity.RevokeSession.IInput['data'];

/** Одна активная сессия пайщика (устройство/IP/время + флаг текущей). */
export type IAccountSession =
  Queries.AccountSecurity.GetSessions.IOutput['getSessions'][number];

/**
 * Самообслуживание активных сессий: список + точечное и массовое завершение.
 * После любого завершения перечитываем список — источник истины на сервере.
 */
export function useManageSessions() {
  const sessions = ref<IAccountSession[]>([]);
  const loading = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    try {
      sessions.value = await api.getSessions();
    } finally {
      loading.value = false;
    }
  }

  async function revoke(sessionId: string): Promise<void> {
    await api.revokeSession({ session_id: sessionId });
    await load();
  }

  async function revokeAllOthers(): Promise<number> {
    const revoked = await api.revokeAllSessions();
    await load();
    return revoked;
  }

  return {
    sessions,
    loading,
    load,
    revoke,
    revokeAllOthers,
  };
}
