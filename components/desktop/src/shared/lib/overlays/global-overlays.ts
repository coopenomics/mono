import { markRaw, shallowReactive, type Component } from 'vue';

export interface GlobalOverlayEntry {
  /** Стабильный ключ оверлея — для идемпотентной регистрации и :key в рендере. */
  id: string;
  component: Component;
}

/**
 * Универсальный реестр-фабрика глобальных оверлеев приложения.
 *
 * Зачем: App-шелл НЕ должен знать о конкретных оверлеях. Особенно — об оверлеях
 * РАСШИРЕНИЙ: App не может (и не должен) импортировать widget'ы marketplace и
 * прочих расширений. Любой глобальный персистентный оверлей —
 *   - онбординг-оферты (подпись соглашений),
 *   - выбор кооперативного участка,
 *   - гейт подписи на месте marketplace,
 *   - будущие подписи соглашений других расширений —
 * регистрируется СЮДА, а App рендерит реестр обобщённо через <component :is>,
 * ничего конкретного не импортируя.
 *
 * Кто регистрирует:
 *   - платформенные оверлеи — из app-bootstrap (registerCoreOverlays);
 *   - оверлеи расширений — из `extensions/<ext>/install.ts`, ровно там же, где
 *     расширение «вкладывает» в ядро свои routes и process-info-хендлеры.
 *
 * Каждый оверлей сам решает свою видимость (self-gating) — реестр лишь монтирует.
 */
const overlays = shallowReactive<GlobalOverlayEntry[]>([]);

/**
 * Зарегистрировать глобальный оверлей. Идемпотентно по `id`: повторная
 * установка расширения / повторный mount App не плодят дубли.
 */
export function registerGlobalOverlay(id: string, component: Component): void {
  if (overlays.some((o) => o.id === id)) return;
  overlays.push({ id, component: markRaw(component) });
}

/** Реактивный список зарегистрированных оверлеев — для рендера в App-шелле. */
export function getGlobalOverlays(): GlobalOverlayEntry[] {
  return overlays;
}
