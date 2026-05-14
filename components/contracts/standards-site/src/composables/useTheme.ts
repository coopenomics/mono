/**
 * Управление темой (светлая / тёмная).
 *
 * Источники выбора по приоритету:
 *   1. явный выбор пользователя → localStorage 'standards.theme'
 *   2. системная настройка `prefers-color-scheme`
 *
 * Тема применяется атрибутом `data-theme` на <html>; CSS-переменные в
 * style.css делают всю остальную работу.
 */

import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'standards.theme';

function readStored(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

function detectSystem(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

// ── Singleton state ────────────────────────────────────────────────────────
const theme = ref<Theme>(readStored() ?? detectSystem());
let initialized = false;

function init(): void {
  if (initialized) return;
  initialized = true;
  applyTheme(theme.value);

  // Если пользователь ничего явно не выбрал — отслеживаем системную настройку.
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent): void => {
      if (readStored() !== null) return; // у пользователя явный выбор — не трогаем
      theme.value = e.matches ? 'dark' : 'light';
    };
    mql.addEventListener('change', listener);
  }
}

watch(theme, (t) => {
  applyTheme(t);
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // ignore — приватный режим / заблокированные cookies
  }
});

// Применим тему на <html> как можно раньше (при первом импорте composable).
if (typeof document !== 'undefined') {
  applyTheme(theme.value);
}

export function useTheme(): {
  theme: typeof theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
} {
  onMounted(init);
  onBeforeUnmount(() => {
    // singleton — ничего специально отключать не нужно
  });

  return {
    theme,
    toggle: () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark';
    },
    setTheme: (t: Theme) => {
      theme.value = t;
    },
  };
}
