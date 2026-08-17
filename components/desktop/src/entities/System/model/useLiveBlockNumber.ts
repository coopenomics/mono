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
  /**
   * Узел откатился назад — форк цепи или переустановленная позиция чтения.
   * Показанное число назад не отматываем: убывающий счётчик читается как авария,
   * хотя для узла это штатная работа. Замираем, пока цепь не дорастёт обратно.
   */
  let frozen = false;

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
      if (frozen) return;
      if (displayed.value !== null) displayed.value += 1;
    }, BLOCK_INTERVAL_MS);
  };

  watch(
    source,
    (value) => {
      if (typeof value !== 'number') {
        displayed.value = null;
        frozen = false;
        stop();
        return;
      }
      if (displayed.value !== null && value <= displayed.value) {
        // Назад не идём: ждём на месте, пока цепь не дорастёт до показанного.
        frozen = true;
        start();
        return;
      }
      // Пришло настоящее значение и оно впереди — оно и есть истина.
      displayed.value = value;
      frozen = false;
      start();
    },
    { immediate: true },
  );

  onUnmounted(stop);

  return computed(() => displayed.value);
}
