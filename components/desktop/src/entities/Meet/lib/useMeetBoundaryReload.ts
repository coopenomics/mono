import { onBeforeUnmount, watch, type WatchSource } from 'vue';
import type { IMeet } from '../types';

/**
 * Перечитать собрания в момент, когда меняется их шаг по времени.
 *
 * Открытие и закрытие голосования — не события цепи: шаг «Голосование» сервер
 * вычисляет по датам в момент чтения. Без перечитывания страница держала
 * «откроется через несколько секунд», пока лента не сообщала о другом изменении.
 * Помощник ставит одно ожидание до ближайшей будущей даты открытия или
 * закрытия и перечитывает собрания чуть позже неё.
 */
const AFTER_BOUNDARY_MS = 1500;
// Ожидание дольше суток не ставится: страницу столько не держат открытой,
// а таймер браузера на больших задержках ненадёжен.
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

function nextBoundary(meets: IMeet[], now: number): number | null {
  let next: number | null = null;
  for (const meet of meets) {
    const row = meet?.processing?.meet;
    for (const value of [row?.open_at, row?.close_at]) {
      if (!value) continue;
      const at = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(String(value)) ? String(value) : `${value}Z`);
      if (Number.isFinite(at) && at > now && (next === null || at < next)) next = at;
    }
  }
  return next;
}

export function useMeetBoundaryReload(meets: WatchSource<IMeet[]>, reload: () => unknown): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  watch(
    meets,
    (list) => {
      clear();
      const now = Date.now();
      const boundary = nextBoundary(list ?? [], now);
      if (boundary === null) return;
      const delay = boundary - now + AFTER_BOUNDARY_MS;
      if (delay > MAX_WAIT_MS) return;
      // timing: schedule — перечитать собрание в момент открытия или закрытия голосования
      timer = setTimeout(() => {
        timer = null;
        void reload();
      }, delay);
    },
    { immediate: true, deep: false },
  );

  onBeforeUnmount(clear);
}
