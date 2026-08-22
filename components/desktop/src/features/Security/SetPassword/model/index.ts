export * from './useNewPasswordForm';
import { ref } from 'vue';
import { migrate } from '@coopenomics/auth';
import { useGlobalStore } from 'src/shared/store';
import { useSessionStore } from 'src/entities/Session';
import { useLoginUser } from 'src/features/User/LoginUser';

/**
 * «Позже» в диалоге мягкой миграции — до перезагрузки страницы: module-scope
 * переживает ремаунты компонента, поэтому напоминание не повторяется в рамках
 * одной загрузки, но вернётся при следующем запуске приложения.
 */
export const migrationOfferDismissed = ref(false);

/**
 * Переход «ключ → пароль» в активной легаси-сессии (Story 11.6, in-session):
 * пайщик уже вошёл по ключу; берём ключ из keystore (`globalStore.wif`) и email из
 * профиля, доказываем владение и ставим пароль в server-vault через SDK `migrate()`.
 * Приватный ключ на сервер не уходит — только шифр.
 *
 * `migrate()` РОТИРУЕТ ключ (старый гаснет on-chain) и отзывает все сессии на
 * сервере, поэтому сразу за ним:
 *  1. стираем легаси-артефакты (ключ/токены в IndexedDB) — они мертвы by design,
 *     а `session.init()` после перезагрузки предпочёл бы их и собрал сессию
 *     поверх отозванных токенов;
 *  2. выполняем ПЕРЕВХОД по только что заданному паролю — тем же путём, что и
 *     вход с формы. Пайщик остаётся в системе на свежей CoopID-сессии.
 *
 * Признак «пароль установлен» приходит с сервера (`Account.has_password`) —
 * локальные отметки в браузере не нужны и врали бы на других устройствах.
 */
export function useSetPassword() {
  const globalStore = useGlobalStore();
  const session = useSessionStore();
  const { loginWithPassword } = useLoginUser();

  async function setPassword(newPassword: string): Promise<void> {
    const email = session.providerAccount?.email;
    if (!email) {
      throw new Error('Не удалось определить email для установки пароля.');
    }
    const privateKey = await globalStore.ensureSigningKey();
    await migrate({ email, privateKey, newPassword });
    await globalStore.clearLegacyCredentials();
    // Автоматический перевход: новые токены + CoopID-сессия, без выброса на вход.
    // 2FA здесь не встретится: факторы включаются только после установки пароля.
    await loginWithPassword(email, newPassword);
  }

  return { setPassword };
}
