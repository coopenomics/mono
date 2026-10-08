import { markRaw, shallowReactive, type Component } from 'vue';

/**
 * Точки монтирования между расширениями.
 *
 * Расширение не импортирует компоненты чужого расширения (граница расширений).
 * Когда одному расширению нужно показать свой блок на странице другого,
 * страница объявляет именованную точку (`ExtensionSlot`), а владелец блока
 * регистрирует в неё компонент при установке. Блок появляется, только если
 * расширение-владелец установлено у кооператива.
 */
interface SlotEntry {
  key: string;
  component: Component;
}

const slots = shallowReactive<Record<string, SlotEntry[]>>({});

/** Зарегистрировать компонент в точке; повторная регистрация того же ключа заменяет прежнюю. */
export function registerSlotComponent(slot: string, key: string, component: Component): void {
  const entry: SlotEntry = { key, component: markRaw(component) };
  slots[slot] = [...(slots[slot] ?? []).filter((one) => one.key !== key), entry];
}

/** Компоненты, зарегистрированные в точке, в порядке регистрации. */
export function slotComponents(slot: string): SlotEntry[] {
  return slots[slot] ?? [];
}

/** Имена точек монтирования — одно место, чтобы страница и владелец блока не расходились. */
export const EXTENSION_SLOTS = {
  /** Профиль участника «Благороста», под кошельками программы. */
  capitalProfileAfterWallets: 'capital:profile:after-wallets',
} as const;
