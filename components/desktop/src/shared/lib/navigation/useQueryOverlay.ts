import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * Оверлей, привязанный к query-параметру маршрута.
 *
 * Открытая в оверлее сущность живёт в адресе (`...?story=<hash>`), поэтому:
 * - страница под оверлеем не размонтируется — маршрут не меняется, у списка
 *   физически сохраняются скролл, догруженная лента и всё состояние;
 * - открытие делает push → нативный «назад» браузера (и свайп на телефоне)
 *   закрывает оверлей, а не уводит со страницы;
 * - ссылка копируется и пересылается, F5 восстанавливает открытую сущность.
 */
export function useQueryOverlay(param: string) {
  const route = useRoute();
  const router = useRouter();

  const value = computed<string | null>(() => {
    const raw = route.query[param];
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  });

  const isOpen = computed(() => value.value !== null);

  function open(v: string): void {
    if (value.value === v) return;
    void router.push({ query: { ...route.query, [param]: v } });
  }

  function close(): void {
    if (value.value === null) return;
    // Если оверлей открыт с этой же страницы — честный back(): уходит ровно
    // одна запись истории, и следующий «назад» ведёт куда ожидалось. Если же
    // пользователь пришёл по прямой ссылке с параметром (истории нет или она
    // ведёт на другую страницу) — back() увёл бы со страницы вместо закрытия,
    // поэтому просто снимаем параметр, не трогая историю.
    const back = router.options.history.state.back;
    if (typeof back === 'string' && back.split('?')[0] === route.path) {
      router.back();
      return;
    }
    const query = { ...route.query };
    delete query[param];
    void router.replace({ query });
  }

  return { value, isOpen, open, close };
}
