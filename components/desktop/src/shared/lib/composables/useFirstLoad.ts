import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from 'vue';

/**
 * «Первая загрузка ещё идёт» — единственный момент, когда на экране уместен
 * каркас (скелетон). Дальше данные обновляются молча: realtime-дочитка,
 * страховочный resync, поллинг — всё это снова ставит `loading = true`, и
 * условие вида `loading && !items.length` на пустом списке каждый раз сносило
 * содержимое в скелетон и возвращало обратно — страница мерцала раз в минуту
 * (Стол заказов, 2026-09-09). Признак «пусто» не отличает «ещё не грузили»
 * от «загрузили, а там пусто»; отличает — факт завершённой загрузки.
 *
 * Возвращает `true`, пока `loading` истинен и ни одна загрузка ещё не
 * завершилась. После первого перехода `loading: true → false` — всегда `false`.
 */
export function useFirstLoad(loading: MaybeRefOrGetter<boolean>): ComputedRef<boolean> {
  const settled = ref(false);
  watch(
    () => Boolean(toValue(loading)),
    (now, was) => {
      if (was && !now) settled.value = true;
    },
  );
  return computed(() => !settled.value && Boolean(toValue(loading)));
}
