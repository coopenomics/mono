import type { RouteLocationRaw, Router } from 'vue-router';

/**
 * Единая семантика кнопки «Назад»: назад — значит туда, откуда пришёл.
 *
 * Если в истории приложения есть предыдущая запись — обычный `router.back()`:
 * он вернёт пользователя ровно на тот экран, с которого он открыл текущий,
 * с его параметрами и query. Если истории нет (прямой заход по ссылке, новая
 * вкладка) — переход на канонический родительский экран `fallback`.
 *
 * Это замена трёх конкурировавших механизмов (`_backRoute`-имя маршрута,
 * `_backRoute`-ключ sessionStorage со снимком, `_useHistoryBack`): они
 * пытались угадать «откуда пришли» через query, потому что переключение
 * вкладок замусоривало историю push-записями. Теперь вкладки ходят через
 * replace (см. PageTabs), история чистая, и `back()` честен.
 */
export function goBackOr(router: Router, fallback: RouteLocationRaw): void {
  const back = router.options.history.state.back;
  if (typeof back === 'string' && back.length > 0) {
    router.back();
    return;
  }
  void router.push(fallback);
}
