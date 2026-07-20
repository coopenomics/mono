import { boot } from 'quasar/wrappers';
import { UpdateAlert } from 'src/shared/api/alerts';

// Связывает window-событие 'sw:update-available' с канон-тостом. Источник события —
// version-watch (src/entities/AppVersion) по self-report ноды /version; lifecycle
// service worker'а как триггер отключён (ненадёжен на iOS standalone и др.).
// По «Обновить» зовём window.applyUpdate() (SKIP_WAITING → controllerchange → reload,
// либо прямой reload если waiting-SW нет — см. register-service-worker.ts).
export default boot(() => {
  if (typeof window === 'undefined') return; // SSR-safe: только клиент

  // Флаг гасит ДУБЛИ одного и того же обновления (registration.update()
  // дёргается на каждый visibilitychange). При «Позже» сбрасываем — чтобы
  // СЛЕДУЮЩИЙ релиз снова показал тост. «Обновить» перезагружает страницу.
  let shown = false;
  window.addEventListener('sw:update-available', () => {
    if (shown) return;
    shown = true;
    UpdateAlert(
      () => {
        const w = window as unknown as { applyUpdate?: () => void };
        if (typeof w.applyUpdate === 'function') {
          w.applyUpdate();
        } else {
          window.location.reload();
        }
      },
      () => {
        shown = false; // отклонил → разрешаем показать при следующем релизе
      },
    );
  });
});
