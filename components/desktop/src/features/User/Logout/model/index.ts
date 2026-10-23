import { nextTick } from 'vue';
import { currentTokens } from '@coopenomics/auth';
import { useSessionStore } from 'src/entities/Session';
import { serverLogout } from 'src/entities/Session/lib/serverLogout';
import { useGlobalStore } from 'src/shared/store';
import { useRegistratorStore } from 'src/entities/Registrator';

/**
 * Забыть устройство целиком: серверную сессию (токены и cookie), вход по паролю,
 * вход по ключу, PIN-кэш, аккаунт и сохранённое состояние вступления.
 *
 * Одна точка для «Выйти» и для потери доступа (решение владельца 16.10.2026): раз
 * нужен вход или регистрация заново, ничего от прежней сессии оставаться не должно.
 * Остатки смешивались с новой регистрацией — подставлялись чужие данные анкеты, а
 * cookie принятого пайщика на секунду показывала меню кабинета.
 *
 * Перезагрузку страницы делает вызывающий.
 */
export async function resetDevice(): Promise<void> {
  const global = useGlobalStore();
  const session = useSessionStore();

  // Токены — до очистки браузера: после неё отзывать будет нечем. Пара CoopID и
  // пара легаси могут принадлежать разным людям, поэтому отзываются обе.
  const coop = currentTokens();
  const legacy = global.tokens;
  // Отказ сервера браузер не держит: очистка ниже идёт в любом случае.
  await serverLogout({ accessToken: coop?.accessToken, refreshToken: coop?.refreshToken }).catch(() => undefined);
  if (legacy?.access?.token) {
    await serverLogout({ accessToken: legacy.access.token, refreshToken: legacy.refresh?.token }).catch(() => undefined);
  }

  useRegistratorStore().clearUserData();
  await session.close();
  session.clearAccount();
  // Состояние вступления хранится в localStorage подпиской стора — даём ей
  // записаться до перезагрузки.
  await nextTick();
}

export function useLogoutUser() {
  return {
    logout: resetDevice,
  };
}
