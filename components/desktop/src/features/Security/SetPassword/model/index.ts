export * from './useNewPasswordForm';
import { ref } from 'vue';
import { migrate } from '@coopenomics/auth';
import { useRoute, useRouter } from 'vue-router';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { useLoginUser } from 'src/features/User/LoginUser';
import { useLogoutUser } from 'src/features/User/Logout';

/**
 * «Позже» в диалоге мягкой миграции — до перезагрузки страницы: module-scope
 * переживает ремаунты компонента, поэтому напоминание не повторяется в рамках
 * одной загрузки, но вернётся при следующем запуске приложения.
 */
export const migrationOfferDismissed = ref(false);

/**
 * Пароль установлен, но перевход не удался. Это НЕ ошибка установки: на
 * сервере пароль уже записан, старый ключ уже погашен в цепи, сессии уже
 * отозваны — и «повторить» бессмысленно: повторный `migrate` получит 400, потому
 * что подписывать ему больше нечем. Вызывающая сторона обязана отличать этот
 * случай и вести пайщика на вход по новому паролю, а не оставлять в диалоге с
 * кнопкой, которая больше не сработает. Ровно так застрял председатель на проде
 * 23.08.2026: пароль стоял, а экран предлагал «установить» ещё раз.
 */
export class PasswordSetReloginFailedError extends Error {
  constructor(readonly cause: unknown) {
    super('Пароль установлен, войдите по нему заново');
    this.name = 'PasswordSetReloginFailedError';
  }
}

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
  // Инъекции берём в setup-контексте: внутри async-функции после await их уже нет.
  const router = useRouter();
  const route = useRoute();
  const { logout } = useLogoutUser();

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
    //
    // С этой строки любой сбой — уже не сбой установки: пароль записан, ключ
    // погашен, назад дороги нет. Поднимаем особую ошибку, чтобы экран не
    // предлагал «повторить» то, что повторить нельзя.
    try {
      await loginWithPassword(email, newPassword);
    } catch (e) {
      throw new PasswordSetReloginFailedError(e);
    }
  }

  /**
   * Установка пароля с экрана: один исход на оба экрана (оверлей и карточка
   * настроек), чтобы они не разъезжались в том, что показать пайщику.
   *
   * Возвращает true, если пайщик остался в кабинете. Если пароль записан, а
   * перевход не удался — выходим сами и ведём на форму входа: сессия на сервере
   * уже отозвана, и первый же запрос выбросил бы его без объяснений. Сообщение
   * говорит, что именно произошло и что делать, — в отличие от сырого текста
   * ошибки тихого входа, в котором «IFrame timed out» ничего не объясняет.
   */
  async function setPasswordFromScreen(newPassword: string): Promise<boolean> {
    try {
      await setPassword(newPassword);
      SuccessAlert('Пароль установлен — вы уже вошли по нему, работайте дальше.');
      return true;
    } catch (e) {
      if (e instanceof PasswordSetReloginFailedError) {
        SuccessAlert('Пароль установлен. Войдите по нему — автоматический вход не удался.');
        const coopname = route.params.coopname;
        await logout().catch(() => undefined);
        void router.push({ name: 'signin', params: { coopname } });
        return false;
      }
      FailAlert(e);
      return false;
    }
  }

  return { setPassword, setPasswordFromScreen };
}
