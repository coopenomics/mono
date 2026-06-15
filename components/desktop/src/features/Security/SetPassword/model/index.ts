import { LocalStorage } from 'quasar';
import { migrate } from '@coopenomics/auth';
import { useGlobalStore } from 'src/shared/store';
import { useSessionStore } from 'src/entities/Session';

/**
 * Миграция «ключ → пароль» в активной легаси-сессии (Story 11.6, in-session):
 * пайщик уже вошёл по ключу; берём ключ из keystore (`globalStore.wif`) и email из
 * профиля, доказываем владение и ставим пароль в server-vault через SDK `migrate()`.
 * Приватный ключ на сервер не уходит — только шифр. Сессию НЕ переустанавливаем
 * (она и так активна); пароль заработает на следующем входе.
 */
export function useSetPassword() {
  const globalStore = useGlobalStore();
  const session = useSessionStore();

  async function setPassword(newPassword: string): Promise<void> {
    const email = session.providerAccount?.email;
    const privateKey = globalStore.wif?.toString();
    if (!email || !privateKey) {
      throw new Error('Не удалось определить ключ доступа или email для установки пароля.');
    }
    await migrate({ email, privateKey, newPassword });
    LocalStorage.set(`coopid:migrated:${email}`, true);
  }

  return { setPassword };
}
