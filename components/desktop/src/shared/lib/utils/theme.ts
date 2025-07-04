import { LocalStorage } from 'quasar';
import { Dark } from 'quasar';

const THEME_KEY = 'theme-mode';

export function saveThemeToStorage(isDark: boolean) {
  if (process.env.CLIENT) {
    LocalStorage.set(THEME_KEY, isDark ? 'dark' : 'light');
  }
}

export function getThemeFromStorage(): 'dark' | 'light' | null {
  if (process.env.CLIENT) {
    const saved = LocalStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return null;
  }
  return null;
}

export function applyThemeFromStorage() {
  if (process.env.CLIENT) {
    const saved = getThemeFromStorage();
    if (saved === 'dark') {
      Dark.set(true);
    } else if (saved === 'light') {
      Dark.set(false);
    }
  }
}

// Цвета для PWA theme-color
const PWA_THEME_COLORS = {
  light: '#ffffff',
  dark: '#1d1d1d', // Используем $dark из quasar-variables.sass
};

/**
 * Обновляет PWA theme-color в зависимости от текущей темы
 */
export function updatePWAThemeColor(isDark: boolean) {
  if (process.env.CLIENT && typeof document !== 'undefined') {
    const themeColor = isDark ? PWA_THEME_COLORS.dark : PWA_THEME_COLORS.light;

    // Обновляем meta тег theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', themeColor);

    // Обновляем meta тег для iOS
    let metaAppleStatusBar = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    if (!metaAppleStatusBar) {
      metaAppleStatusBar = document.createElement('meta');
      metaAppleStatusBar.setAttribute(
        'name',
        'apple-mobile-web-app-status-bar-style',
      );
      document.head.appendChild(metaAppleStatusBar);
    }
    metaAppleStatusBar.setAttribute(
      'content',
      isDark ? 'black-translucent' : 'default',
    );
  }
}

/**
 * Настраивает автоматическое обновление PWA theme-color при изменении темы
 * Должен вызываться в Vue компоненте или composable
 */
export function setupPWAThemeColorWatcher() {
  if (process.env.CLIENT) {
    // Применяем текущую тему
    updatePWAThemeColor(Dark.isActive);
  }
}
