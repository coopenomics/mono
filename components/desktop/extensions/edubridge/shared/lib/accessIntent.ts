/**
 * Намерение «получить доступ» в адресе страницы. Кнопка на странице курса
 * уводит человека без подписанной оферты на подпись; намерение едет в адресе,
 * и после подписи страница курса продолжает оформление сама.
 */
export type AccessMode = 'enroll' | 'extend';

/** Параметр адреса страницы курса: открыть оформление доступа сразу. */
export const ACCESS_QUERY = 'access';

/** Режим оформления из параметра адреса; `null` — параметра нет либо значение чужое. */
export function accessModeOf(value: unknown): AccessMode | null {
  return value === 'enroll' || value === 'extend' ? value : null;
}
