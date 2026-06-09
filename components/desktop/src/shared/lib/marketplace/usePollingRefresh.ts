import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/**
 * Тихое периодическое обновление списка marketplace-стола.
 *
 * Зачем: статус заказа/акта меняет ДРУГОЙ участник со своего устройства
 * (поставщик подписал приёмку → закрывающая подпись председателя; председатель
 * открыл выдачу → финальная подпись заказчика). Без авто-обновления экран
 * остаётся старым, и нужное действие «не высвечивается», пока страницу не
 * перезагрузят руками. Тихий poll подтягивает переход сам (до перехода на
 * websocket-подписку — техдолг #38).
 *
 * Канон: НЕ перетягивать данные, пока предыдущая загрузка идёт (`isBusy`),
 * чтобы poll не накладывался на ручное действие и не моргал скелетоном —
 * обновляем молча.
 */
export function usePollingRefresh(
  refresh: () => void | Promise<void>,
  opts: { intervalMs: number; isBusy?: Ref<boolean> },
): void {
  let timer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    timer = setInterval(() => {
      if (opts.isBusy?.value) return;
      void refresh();
    }, opts.intervalMs);
  });

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    timer = null;
  });
}
