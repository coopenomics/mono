import { decryptPrivateKey, fetchVaultBlob, migrate } from '@coopenomics/auth';
import { env } from 'src/shared/config';
import { useSessionStore } from 'src/entities/Session';
import { useLoginUser } from 'src/features/User/LoginUser';

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
 * ключ гаснет on-chain, все сессии отзываются — чужие (и возможно
 * скомпрометированные) умирают вместе со старым паролем. Это остаётся: смена
 * пароля обязана гасить сеансы, иначе она не защищает ни от чего.
 *
 * А вот выбрасывать на форму входа ТОГО, кто пароль и меняет, незачем: он уже
 * в кабинете, новый пароль только что набрал сам и подтвердил знанием старого.
 * Поэтому сразу за отзывом сессий поднимаем текущую заново — тем же способом,
 * что и мастер перехода на пароль. Со стороны пайщика смена пароля выглядит
 * как смена пароля, а не как выход из системы.
 */
export function useChangePassword() {
  const session = useSessionStore();
  const { loginWithPassword } = useLoginUser();

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
    // Свой сеанс поднимаем обратно новым паролём: сессии только что отозваны
    // все разом, включая текущую. Второго фактора здесь не встретится — его
    // спрашивают на входе по паролю, а этот вход выполняется сразу за сменой,
    // подтверждённой знанием старого пароля.
    await loginWithPassword(email, newPassword);
  }

  return { changePassword };
}
