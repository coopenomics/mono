import { computed, onUnmounted, ref, watch } from 'vue';

/** Шаг отрисовки. Полсекунды — темп блока в цепи. */
const TICK_MS = 500;
/**
 * За сколько шагов выбирается разрыв до последнего известного блока. Узел
 * присылает состояние примерно раз в три секунды, то есть за шесть шагов —
 * столько же и берём, тогда движение получается ровным, без рывков в конце.
 */
const CATCH_UP_TICKS = 6;

/**
 * Номер блока, который движется ровно, а не рывками по приходу сообщений.
 *
 * Узел присылает своё состояние раз в несколько секунд — чаще не нужно, это
 * был бы поток ради потока. Но показывать значение только по приходу сообщения
 * значит дёргать число скачком на несколько блоков, а между скачками держать
 * его замершим.
 *
 * Поэтому пришедшее значение становится целью, а показанное подтягивается к
 * ней шагами по полсекунды. Догнало — стоит и ждёт следующего сообщения.
 * Цель никогда не уменьшается: форк цепи или переустановленная позиция чтения
 * дают номер меньше показанного, и отмотка назад читалась бы как авария, хотя
 * для узла это штатная работа.
 *
 * Значение показательное: между сообщениями оно может разойтись с цепью на
 * единицы блоков. Оно отвечает на вопрос «узел жив?», а не «на каком мы блоке».
 */
export function useLiveBlockNumber(source: () => number | null | undefined) {
  const displayed = ref<number | null>(null);
  let target: number | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const step = () => {
    // Вкладка в фоне — рисовать некому, а сообщения от узла туда всё равно не
    // приходят: сокет там усыплён браузером.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (target === null) return;
    if (displayed.value === null || displayed.value >= target) return;

    const gap = target - displayed.value;
    displayed.value += Math.max(1, Math.ceil(gap / CATCH_UP_TICKS));
    if (displayed.value > target) displayed.value = target;
  };

  const start = () => {
    // На сервере таймеров не заводим: рендер там одноразовый.
    if (typeof window === 'undefined' || timer) return;
    timer = setInterval(step, TICK_MS);
  };

  watch(
    source,
    (value) => {
      if (typeof value !== 'number') {
        displayed.value = null;
        target = null;
        stop();
        return;
      }
      // Цель только растёт — назад показанное число не идёт никогда.
      target = target === null ? value : Math.max(target, value);
      if (displayed.value === null) displayed.value = target;
      start();
    },
    { immediate: true },
  );

  onUnmounted(stop);

  return computed(() => displayed.value);
}
