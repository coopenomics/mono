import { computed, onUnmounted, ref, watch } from 'vue';

/** Блок в цепи выходит раз в полсекунды — с этим темпом и досчитываем. */
const BLOCK_INTERVAL_MS = 500;

/**
 * Номер блока, который «щёлкает» с темпом цепи между сообщениями от узла.
 *
 * Узел присылает своё состояние раз в несколько секунд — чаще не нужно, это
 * был бы поток ради потока. Но замерший номер выглядит как остановка, поэтому
 * между сообщениями значение досчитывается локально по известному темпу
 * блоков, а каждое пришедшее сообщение возвращает его к правде.
 *
 * Значение показательное: между сверками оно может разойтись с цепью на
 * единицы блоков. Решения по нему не принимаются — оно отвечает на вопрос
 * «узел жив?», а не «на каком мы блоке».
 */
export function useLiveBlockNumber(source: () => number | null | undefined) {
  const displayed = ref<number | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    // На сервере таймеров не заводим: рендер там одноразовый.
    if (typeof window === 'undefined' || timer) return;
    timer = setInterval(() => {
      // Вкладка в фоне — щёлкать некому, а сообщения от узла всё равно не
      // приходят: сокет там усыплён браузером.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (displayed.value !== null) displayed.value += 1;
    }, BLOCK_INTERVAL_MS);
  };

  watch(
    source,
    (value) => {
      if (typeof value !== 'number') {
        displayed.value = null;
        stop();
        return;
      }
      // Пришло настоящее значение — оно и есть истина, досчёт начинается с него.
      displayed.value = value;
      start();
    },
    { immediate: true },
  );

  onUnmounted(stop);

  return computed(() => displayed.value);
}
