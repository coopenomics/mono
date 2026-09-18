import { watch } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useExitGate } from 'src/features/Membership/ExitFromCoop/model';

const POLL_INTERVAL_MS = 15000;

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Процесс глобального gate выхода: пока пайщик авторизован, периодически
 * опрашивает статус выхода. Когда выход активен — overlay блокирует кабинет
 * (см. ExitOverlay в App.vue). Статус выхода живёт на цепи (registrator::exits),
 * в сторах его нет — поэтому опрашиваем, а не реактивно выводим.
 */
export function useExitOverlayProcess() {
  // Опрос нужен только в браузере: токен доступа живёт там же. При серверной
  // отрисовке сессия поднимается из cookie, поэтому пайщик считается
  // авторизованным, а заголовка авторизации у запроса нет — сервер отвечал
  // отказом. Хуже, что таймер, заведённый здесь при отрисовке страницы,
  // оставался жить в процессе отрисовки и стучался каждые 15 секунд уже после
  // того, как страница отдана: за сорок минут — сорок отказов на ровном месте.
  // То же решение принято для мониторинга состояния узла (System/store.ts).
  if (typeof window === 'undefined') return;

  const session = useSessionStore();
  const { loadExitStatus } = useExitGate();

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      void loadExitStatus();
    }, POLL_INTERVAL_MS);
  };

  const sync = () => {
    if (session.isAuth) {
      void loadExitStatus();
      startPolling();
    } else {
      stopPolling();
      void loadExitStatus();
    }
  };

  sync();

  watch(() => session.isAuth, sync);
}
