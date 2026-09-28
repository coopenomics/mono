import { watch } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { RegistratorContract } from 'cooptypes';
import { useExitGate } from 'src/features/Membership/ExitFromCoop/model';
import { registerLiveReload, liveTable } from 'src/shared/lib/realtime';

let exitWatch: { dispose: () => void } | null = null;

/**
 * Процесс глобального gate выхода: пока пайщик авторизован, статус выхода
 * перечитывается по ленте изменений (registrator::exits — строки пайщика ему
 * и совету). Когда выход активен — overlay блокирует кабинет (см. ExitOverlay
 * в App.vue). Прежний опрос раз в 15 секунд больше не нужен: изменение
 * приходит сигналом, а после переподключения лента дочитывает сама.
 */
export function useExitOverlayProcess() {
  // Опрос нужен только в браузере: токен доступа живёт там же. При серверной
  // отрисовке сессия поднимается из cookie, поэтому пайщик считается
  // авторизованным, а заголовка авторизации у запроса нет — сервер отвечал
  // отказом. Хуже, что таймер, заведённый здесь при отрисовке страницы,
  // оставался жить в процессе отрисовки и стучался каждые 15 секунд уже после
  // того, как страница отдана: за сорок минут — сорок отказов на ровном месте.
  // Подписка ленты — тоже только в браузере.
  // То же решение принято для мониторинга состояния узла (System/store.ts).
  if (typeof window === 'undefined') return;

  const session = useSessionStore();
  const { loadExitStatus } = useExitGate();

  const stopWatching = () => {
    exitWatch?.dispose();
    exitWatch = null;
  };

  const startWatching = () => {
    if (exitWatch) return;
    exitWatch = registerLiveReload(
      [
        liveTable(RegistratorContract, RegistratorContract.Tables.Exits),
        { code: 'core', table: 'membership_exit_requests' },
      ],
      () => loadExitStatus(),
    );
  };

  const sync = () => {
    if (session.isAuth) {
      void loadExitStatus();
      startWatching();
    } else {
      stopWatching();
      void loadExitStatus();
    }
  };

  sync();

  watch(() => session.isAuth, sync);
}
