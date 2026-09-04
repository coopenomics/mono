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

  function update(): void {
    const el = trackRef.value;
    if (!el) return;

    // Решение «нужны ли стрелки» принимается по ПОЛНОЙ ширине полосы — как
    // если бы стрелок не было: к текущей ширине вкладок прибавляется ширина
    // реально отрендеренных стрелок из DOM. Формула нарочно не зависит от
    // собственного результата: сравнение с текущей шириной давало петлю на
    // границе помещаемости — стрелки появились → сузили полосу → следующий
    // замер успевал пройти до перерисовки и решал, что стрелки не нужны → они
    // исчезали → полоса расширялась → и так бесконечно, полоса дёргалась.
    // Замер отрендеренного (offsetWidth без внешних отступов) даёт лёгкий
    // запас в нужную сторону: показавшись, стрелки скрываются только когда
    // вкладки помещаются с небольшим избытком.
    let arrowsWidth = 0;
    const bar = el.parentElement;
    if (bar) {
      // Array.from, а не перебор NodeList напрямую: цель сборки ниже ES2015,
      // и без него vue-tsc валит сборку на отсутствии итератора у NodeListOf.
      for (const arrow of Array.from(bar.querySelectorAll(':scope > .tabbar__arrow'))) {
        arrowsWidth += (arrow as HTMLElement).offsetWidth;
      }
    }
    const fullWidth = el.clientWidth + arrowsWidth;
    // Порог в 1px — защита от дробных значений при масштабировании страницы
    scrollable.value = el.scrollWidth - fullWidth > 1;

    const pos = el.scrollLeft;
    const overflow = el.scrollWidth - el.clientWidth;
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
