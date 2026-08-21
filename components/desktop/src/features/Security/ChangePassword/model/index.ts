import { decryptPrivateKey, fetchVaultBlob, migrate } from '@coopenomics/auth';
import { env } from 'src/shared/config';
import { useSessionStore } from 'src/entities/Session';

/**
 * Смена пароля из настроек (при известном старом пароле).
 *
 * Пароль хранится только в authentik, у платформы его хэша нет — но проверять
 * старый пароль сервером и не нужно: vault-блоб пайщика зашифрован именно
 * текущим паролем, и неверный пароль просто не расшифрует его. Это честное
 * криптографическое доказательство знания старого пароля, а заодно даёт текущий
 * ключ, даже если кошелёк сейчас заперт.
 *
 * Дальше работает конвейер миграции (`migrate` с ротацией): новый пароль уходит
 * в authentik, в vault ложится НОВЫЙ ключ, зашифрованный новым паролем, старый
 * ключ гаснет on-chain, все сессии отзываются. Поэтому после смены пароля
 * пайщик входит заново — чужие (и возможно скомпрометированные) сессии
 * умирают вместе со старым паролем.
 */
export function useChangePassword() {
  const session = useSessionStore();

  async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const account = session.username;
    const email = session.providerAccount?.email;
    if (!account || !email) {
      throw new Error('Не удалось определить аккаунт для смены пароля. Обновите страницу и попробуйте снова.');
    }

    const blob = await fetchVaultBlob(env.BACKEND_URL, account);
    let privateKey: string;
    try {
      privateKey = await decryptPrivateKey(blob, oldPassword, {
        subject_type: 'participant',
        subject_id: account,
      });
    } catch {
      throw new Error('Старый пароль неверен.');
    }

    await migrate({ email, privateKey, newPassword });
  }

  return { changePassword };
}
