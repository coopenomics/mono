import { reactive } from 'vue';

/**
 * Числа на пунктах меню — сколько дел ждёт на странице пункта: документ на
 * подписи, застрявшая выдача доступа и т. п. Расширение регистрирует для своего
 * маршрута загрузчик числа; меню спрашивает его, когда пункт виден, при
 * переходах и раз в минуту. Ноль бейджа не рисует.
 */
export type MenuBadgeLoader = () => Promise<number>;

const loaders = new Map<string, MenuBadgeLoader>();
const counts = reactive<Record<string, number>>({});

/** Загрузчик числа для пункта меню по имени маршрута. */
export function registerMenuBadge(routeName: string, loader: MenuBadgeLoader): void {
  loaders.set(routeName, loader);
}

/** Текущее число пункта; `undefined` — бейджа нет. */
export function menuBadgeOf(routeName: string): number | undefined {
  const n = counts[routeName];
  return n ? n : undefined;
}

/** Есть ли у пункта загрузчик — меню опрашивает только такие. */
export function hasMenuBadge(routeName: string): boolean {
  return loaders.has(routeName);
}

/**
 * Перечитать числа видимых пунктов. Ошибка одного загрузчика не трогает
 * остальные и прежнее число не стирает: сбой сети не должен гасить бейдж.
 */
export async function refreshMenuBadges(routeNames: string[]): Promise<void> {
  await Promise.all(
    routeNames
      .filter((name) => loaders.has(name))
      .map(async (name) => {
        try {
          counts[name] = await loaders.get(name)!();
        } catch {
          /* число останется прежним до следующего опроса */
        }
      }),
  );
}
