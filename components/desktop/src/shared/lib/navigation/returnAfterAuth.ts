import { LocalStorage } from 'quasar';
import type { Router } from 'vue-router';

/**
 * Адрес возврата после входа и регистрации. Человека увели со страницы на вход
 * либо регистрацию — страж навигации с защищённой страницы или кнопка
 * действия, доступного только пайщику. Адрес лежит в хранилище браузера и
 * переживает перезагрузку: регистрация идёт шагами и может занять дни.
 * Применяется один раз — после входа либо после завершения регистрации.
 */
const STORAGE_KEY = 'redirectAfterLogin';

/** Запомнить, куда вернуть человека после входа либо регистрации. */
export function rememberReturnAfterAuth(href: string): void {
  if (!process.env.CLIENT || !href) return;
  LocalStorage.set(STORAGE_KEY, href);
}

/**
 * Уйти по запомненному адресу и забыть его.
 * @returns `false` — адреса нет, вызывающий ведёт человека сам
 */
export function goToReturnAfterAuth(router: Router): boolean {
  if (!process.env.CLIENT) return false;
  const redirectUrl = LocalStorage.getItem(STORAGE_KEY) as string;
  if (!redirectUrl) return false;
  LocalStorage.remove(STORAGE_KEY);
  try {
    if (redirectUrl.startsWith('#')) {
      void router.push(redirectUrl.substring(1));
    } else {
      const url = new URL(redirectUrl);
      void router.push(url.pathname + url.search);
    }
  } catch (e) {
    console.error('Error parsing URL, using direct navigation', e);
    window.location.href = redirectUrl;
  }
  return true;
}
