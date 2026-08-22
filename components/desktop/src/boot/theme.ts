import { boot } from 'quasar/wrappers';
import { Dark } from 'quasar';
import { watch } from 'vue';

function applyTheme(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export default boot(() => {
  // Только клиент: тема — это атрибут data-theme на documentElement, на сервере DOM нет.
  // Вдобавок watch ниже подписан на ГЛОБАЛЬНЫЙ Quasar-реактив Dark (синглтон на все
  // запросы): в SSR boot выполняется на каждый рендер-запрос, и эти подписки копились
  // бы на синглтоне навсегда (утечка, как у Sentry). На сервере тема не нужна.
  if (process.env.SERVER) return;

  applyTheme(Dark.isActive);
  watch(
    () => Dark.isActive,
    (v) => applyTheme(v),
    { immediate: true },
  );
});
