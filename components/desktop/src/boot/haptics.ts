import { boot } from 'quasar/wrappers';

/**
 * Тактильная отдача при ПЕРЕЗАГРУЗКE страницы.
 *
 * Когда приложение открыто на устройстве с поддержкой Vibration API (мобильный
 * браузер / PWA на Android) и страница была именно перезагружена (reload, а не
 * первый заход или переход по ссылке) — коротко «бзыкаем» в руку.
 *
 * Безопасно для обычных сайтов и десктопа: Vibration API там либо отсутствует
 * (`'vibrate' in navigator` === false), либо вызов — no-op. iOS Safari API не
 * поддерживает — там просто ничего не произойдёт. Любая ошибка проглатывается,
 * чтобы тактилка никогда не влияла на работу приложения.
 */

// Короткий одиночный импульс, мс. Достаточно «почувствовать», но не назойливо.
const RELOAD_VIBRATION_MS = 15;

/** Была ли текущая загрузка страницы перезагрузкой (reload). */
function isPageReload(): boolean {
  try {
    // Navigation Timing Level 2 (современные браузеры).
    const navEntry = performance.getEntriesByType?.('navigation')?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navEntry?.type) {
      return navEntry.type === 'reload';
    }

    // Фолбэк на устаревший Navigation Timing Level 1.
    // performance.navigation.type === 1 → TYPE_RELOAD.
    const legacyNav = (performance as unknown as {
      navigation?: { type?: number };
    }).navigation;
    return legacyNav?.type === 1;
  } catch {
    return false;
  }
}

export default boot(() => {
  // Только клиент (в SSR navigator/performance недоступны).
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  try {
    if (!('vibrate' in navigator)) return;
    if (isPageReload()) {
      navigator.vibrate(RELOAD_VIBRATION_MS);
    }
  } catch {
    // Намеренно молча: тактилка — необязательная мелочь, она не должна
    // ни при каких условиях ломать загрузку приложения.
  }
});
