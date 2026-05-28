import { boot } from 'quasar/wrappers';
import { Dark } from 'quasar';
import { watch } from 'vue';

function applyTheme(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export default boot(() => {
  applyTheme(Dark.isActive);
  watch(
    () => Dark.isActive,
    (v) => applyTheme(v),
    { immediate: true },
  );
});
