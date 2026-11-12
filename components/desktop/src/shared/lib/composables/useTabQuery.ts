import { ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * Активный раздел страницы (переключатель PageTabs), связанный с адресом (`?tab=<ключ>`).
 *
 * Скопированная ссылка открывает тот же раздел (слово владельца 09.11.2026:
 * ссылка на «Экономику участка» не учитывала выбранный раздел). Переключение
 * раздела заменяет параметр в адресе без новой записи в истории, переход
 * «назад» по адресу переключает раздел. Незнакомый ключ в адресе — раздел
 * по умолчанию.
 *
 * @param keys ключи разделов страницы
 * @param fallback раздел по умолчанию
 */
export function useTabQuery<K extends string>(keys: readonly K[], fallback: K): Ref<K> {
  const route = useRoute();
  const router = useRouter();
  const parse = (value: unknown): K =>
    (keys as readonly string[]).includes(String(value)) ? (String(value) as K) : fallback;

  const active = ref(parse(route.query.tab)) as Ref<K>;

  watch(active, (key) => {
    if (route.query.tab === key) return;
    void router.replace({ query: { ...route.query, tab: key } });
  });

  watch(
    () => route.query.tab,
    (value) => {
      const key = parse(value);
      if (key !== active.value) active.value = key;
    },
  );

  return active;
}
