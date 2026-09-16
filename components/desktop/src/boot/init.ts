import { boot } from 'quasar/wrappers';
import type { Pinia } from 'pinia';
import { useSessionStore } from 'src/entities/Session';
import { useInitAppProcess } from 'src/processes/init-app';

/**
 * На сервере сторы вне компонентов берут «активную» Pinia. После любой страницы,
 * упавшей при серверной сборке, Vue оставляет контекст внедрения предыдущего
 * запроса, и `useXStore()` в boot ведёт в чужую Pinia: инициализация наполняет
 * чужое состояние, а документ собирается из пустого — пайщик с cookie получал
 * гостевой документ и отказ, а данные одного запроса могли уехать в документ
 * другого. Сверяем стор, взятый явно из Pinia запроса, со стором «по умолчанию»:
 * разошлись — серверную инициализацию пропускаем целиком, документ уходит с
 * чистым состоянием, а всё соберёт браузер, как и до серверного рендера.
 */
function requestContextIsolated(store: unknown): boolean {
  if (!store) return true;
  return useSessionStore(store as Pinia) === useSessionStore();
}

export default boot(async ({ router, store, ssrContext }) => {
  if (typeof window === 'undefined' && !requestContextIsolated(store)) {
    const url = (ssrContext as { req?: { url?: string } } | null | undefined)?.req?.url ?? '';
    console.error(`[ssr] контекст запроса отравлен (${url}): сторы ведут в чужую Pinia, серверная инициализация пропущена`);
    return;
  }
  await useInitAppProcess(router, ssrContext);
});
