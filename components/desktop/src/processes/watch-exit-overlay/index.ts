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
