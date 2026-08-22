import { shallowReactive, type ComputedRef, type Ref } from 'vue';
import type { RailItem } from 'src/shared/ui/layout/AppDrawer';

/**
 * Реестр суб-пунктов левого меню: расширение публикует под пунктом меню
 * (адресация — по имени маршрута пункта) реактивный список дочерних
 * ссылок (например, избранные проекты под пунктом «Проекты»).
 *
 * В отличие от useHeaderActions регистрация живёт не в странице, а в
 * корневом компоненте стола: меню смонтировано постоянно, и очистка на
 * unmount страницы снесла бы суб-пункты при каждом переходе. Источник —
 * computed поверх стора, поэтому состав обновляется сам.
 */
export type MenuSubItemsSource = Ref<RailItem[]> | ComputedRef<RailItem[]>;

const registry = shallowReactive(new Map<string, MenuSubItemsSource>());

export function registerMenuSubItems(parentRouteName: string, source: MenuSubItemsSource): void {
  registry.set(parentRouteName, source);
}

export function unregisterMenuSubItems(parentRouteName: string): void {
  registry.delete(parentRouteName);
}

/** Чтение для LeftDrawerMenu: суб-пункты под пунктом меню по имени его маршрута */
export function useMenuSubItemsReader() {
  return {
    subItemsFor(parentRouteName: string): RailItem[] {
      return registry.get(parentRouteName)?.value ?? [];
    },
  };
}
