import { onBeforeUnmount, watch, type Ref } from 'vue';

/**
 * Публикует фактическую высоту поднятой полосы вкладок в переменную документа
 * `--p-tabs-host-h`.
 *
 * Зачем. Quasar считает странице минимальную высоту «окно минус шапка» и про
 * полосу, вынесенную над содержимым, не знает: страница во весь экран плюс
 * полоса давали вертикальную прокрутку даже на пустом экране — ровно на высоту
 * полосы (жалоба 2026-09-09). Правило в `components.css` укорачивает страницу
 * на эту переменную.
 *
 * Почему меряем, а не считаем из токена. Полоса растёт от содержимого —
 * появляются стрелки прокрутки, кнопки действий, — и любая расчётная цифра
 * рано или поздно разойдётся с настоящей. Мерить сам хост нельзя: он прозрачен
 * для раскладки (`display: contents`) и собственного бокса не имеет.
 *
 * Счётчик общий на все полосы: при переходе между разделами новая полоса
 * успевает смонтироваться до того, как размонтируется прежняя, и уборка «в лоб»
 * стёрла бы только что опубликованную высоту.
 */
const CSS_VAR = '--p-tabs-host-h';
/**
 * Признак на контейнере страниц. Ставится рядом с публикацией высоты, чтобы
 * правило в `components.css` не зависело от того, как именно полоса вложена в
 * каркас: до этого условие искало её по структуре и молча промахивалось.
 */
const CONTAINER_CLASS = 'has-hoisted-tabs';
let hoistedCount = 0;

export function useHoistedTabsHeight(el: Ref<HTMLElement | null>, isHoisted: () => boolean): void {
  let observer: ResizeObserver | null = null;

  function publish(): void {
    const px = el.value?.getBoundingClientRect().height ?? 0;
    if (px > 0) document.documentElement.style.setProperty(CSS_VAR, `${Math.round(px)}px`);
  }

  /** Контейнер страниц, в котором сейчас живёт поднятая полоса. */
  let container: Element | null = null;

  function start(): void {
    if (observer || !el.value || typeof ResizeObserver === 'undefined') return;
    hoistedCount += 1;
    container = el.value.closest('.q-page-container');
    container?.classList.add(CONTAINER_CLASS);
    observer = new ResizeObserver(() => publish());
    observer.observe(el.value);
    publish();
  }

  function stop(): void {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    hoistedCount = Math.max(0, hoistedCount - 1);
    if (hoistedCount === 0) {
      document.documentElement.style.removeProperty(CSS_VAR);
      container?.classList.remove(CONTAINER_CLASS);
    }
    container = null;
  }

  // Следим и за признаком, и за самим узлом: полоса уезжает отложенным
  // телепортом, и на момент `onMounted` её элемента может ещё не быть — разовая
  // проверка там тихо не находила, что мерить, и высота не публиковалась вовсе.
  watch(
    [el, isHoisted] as const,
    ([node, on]) => (node && on ? start() : stop()),
    { immediate: true, flush: 'post' },
  );
  onBeforeUnmount(stop);
}
