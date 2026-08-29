import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

/**
 * Прокрутка горизонтальной полосы вкладок стрелками.
 *
 * Обе стрелки появляются вместе, как только вкладки перестают помещаться, и
 * гаснут поодиночке, когда крутить в ту сторону уже некуда. Показывать их по
 * одной нельзя: полоса меняла бы ширину на каждый щелчок прокрутки.
 *
 * Раньше о возможности прокрутки намекали растворяющие градиенты по краям, но
 * они лежали слоем поверх вкладок — притемняли текст и давали скачок яркости на
 * своём крае, читавшийся как случайная вертикальная линия поперёк слова.
 */
export function useTabsScroll(
  trackRef: Ref<HTMLElement | null>,
  watchSource?: () => unknown,
) {
  const scrollable = ref(false);
  const canScrollLeft = ref(false);
  const canScrollRight = ref(false);

  /**
   * Место, которое займут обе стрелки. Служит гистерезисом: полоса, уже
   * показывающая стрелки, перестаёт считаться прокручиваемой не тогда, когда
   * вкладки едва влезли, а когда запаса хватает и на сами стрелки. Иначе на
   * границе получилась бы петля: стрелки появились → сузили полосу → вкладки
   * снова не помещаются → стрелки нужны → и так по кругу на каждый кадр.
   */
  const ARROWS_WIDTH = 72;

  function update(): void {
    const el = trackRef.value;
    if (!el) return;

    const pos = el.scrollLeft;
    const overflow = el.scrollWidth - el.clientWidth;
    // Пока стрелок нет, переполнение видно как есть. Когда они показаны, полоса
    // под вкладки уже на их ширину — значит и переполнение завышено ровно на
    // неё, и убирать стрелки можно лишь когда без них запаса хватает с избытком.
    // Порог в 1px — защита от дробных значений при масштабировании страницы.
    scrollable.value = scrollable.value ? overflow > ARROWS_WIDTH + 1 : overflow > 1;
    canScrollLeft.value = pos > 1;
    canScrollRight.value = Math.ceil(pos) < overflow - 1;
  }

  function scrollTowards(direction: 1 | -1): void {
    const el = trackRef.value;
    if (!el) return;
    // Шаг — почти вся видимая ширина: так соседняя вкладка остаётся на виду и
    // не теряется ориентир, где пользователь сейчас находится
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  let observer: ResizeObserver | null = null;

  onMounted(() => {
    const el = trackRef.value;
    if (!el) return;

    el.addEventListener('scroll', update, { passive: true });

    // Следим и за самой полосой, и за её содержимым: ширина меняется и при
    // изменении окна, и когда у вкладки появляется счётчик или меняется подпись
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(el);
      for (const child of Array.from(el.children)) observer.observe(child);
    }

    update();
  });

  onBeforeUnmount(() => {
    trackRef.value?.removeEventListener('scroll', update);
    observer?.disconnect();
    observer = null;
  });

  // Набор вкладок задаётся страницей и меняется на лету, поэтому пересчитываем
  // после перерисовки
  if (watchSource) {
    watch(watchSource, () => nextTick(update), { deep: true });
  }

  return { scrollable, canScrollLeft, canScrollRight, scrollTowards, update };
}
