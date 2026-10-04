import { SetMetadata } from '@nestjs/common';

/**
 * Таблица прав приложения (C28-87).
 *
 * Приложение объявляет одну таблицу: роль → условия → права `Ресурс:действие`.
 * Из неё собираются и серверная проверка операции, и набор прав для страниц
 * рабочего стола — два описания одних прав не допускаются. Здесь лежит общее
 * для всех приложений: вид таблицы, чтение её строк и декоратор операции.
 * Роли и условия у каждого приложения свои.
 */

/** Охват права: множество объектов ресурса, на которые оно действует. */
export type RightScope = 'own' | 'own-KU' | 'to-self' | 'all';

/**
 * Охваты уже чем «весь кооператив». Третья часть имени права из этого списка —
 * охват; иная третья часть считается частью действия (`sign:closing`).
 */
const NARROW_SCOPES: ReadonlySet<string> = new Set(['own', 'own-KU', 'to-self']);

/** Группа строк таблицы: права роли, которые действуют при условиях `when`. */
export interface RightsGroup<C extends string = string> {
  when: C[];
  rights: Record<string, string[]>;
}

export type RightsTable<R extends string = string, C extends string = string> = Record<R, RightsGroup<C>[]>;

/**
 * Даёт ли список действий ресурса требуемое действие. Право с охватом `all`
 * покрывает то же действие с узким охватом: «все объекты» включают «свои»,
 * «своего участка» и «адресованные мне». Обратное неверно.
 */
export function rightMatches(actions: string[], action: string): boolean {
  if (actions.includes(action)) return true;
  const colon = action.lastIndexOf(':');
  if (colon > 0 && NARROW_SCOPES.has(action.slice(colon + 1))) {
    return actions.includes(`${action.slice(0, colon)}:all`);
  }
  return false;
}

/**
 * Условия, при которых право действует для пайщика с этими ролями: по одному
 * набору на каждую строку таблицы, которая даёт право. Право действует, когда
 * выполнен хотя бы один набор целиком. Пустой список — право ролям не положено.
 */
export function rightConditions<R extends string, C extends string>(
  table: RightsTable<R, C>,
  roles: R[],
  resource: string,
  action: string
): C[][] {
  const out: C[][] = [];
  for (const role of roles) {
    for (const group of table[role] ?? []) {
      const actions = group.rights[resource];
      if (actions && rightMatches(actions, action)) out.push(group.when);
    }
  }
  return out;
}

/** Права ролей, действующие при выполненных условиях `held`, в виде `Ресурс:действие`. */
export function rightsHeld<R extends string, C extends string>(
  table: RightsTable<R, C>,
  roles: R[],
  held: ReadonlySet<C>
): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    for (const group of table[role] ?? []) {
      if (!group.when.every((condition) => held.has(condition))) continue;
      for (const [resource, actions] of Object.entries(group.rights)) {
        for (const action of actions) set.add(`${resource}:${action}`);
      }
    }
  }
  return [...set];
}

/** Что роли положено вообще, без условий: роль → ресурс → действия. */
export function rightsByRole<R extends string, C extends string>(table: RightsTable<R, C>): Record<R, Record<string, string[]>> {
  const out = {} as Record<R, Record<string, string[]>>;
  for (const role of Object.keys(table) as R[]) {
    const merged: Record<string, string[]> = {};
    for (const group of table[role]) {
      for (const [resource, actions] of Object.entries(group.rights)) {
        merged[resource] = [...(merged[resource] ?? []), ...actions];
      }
    }
    out[role] = merged;
  }
  return out;
}

/**
 * Развернуть права в набор для рабочего стола. Стол сверяет требование
 * страницы с набором простым вхождением и иерархии охватов не знает, поэтому
 * право `…:all` разворачивается в узкие охваты здесь, на сервере.
 */
export function expandRights(rights: string[]): string[] {
  const set = new Set<string>();
  for (const right of rights) {
    set.add(right);
    const colon = right.lastIndexOf(':');
    if (colon > 0 && right.slice(colon + 1) === 'all') {
      for (const scope of NARROW_SCOPES) set.add(`${right.slice(0, colon)}:${scope}`);
    }
  }
  return [...set];
}

export const RIGHT_METADATA_KEY = 'required_right';

/** Требование операции: действие над ресурсом; список действий — любое из них. */
export interface IRightRequirement {
  resource: string;
  action: string | string[];
}

/**
 * Право, которое требует операция: `@RequireRight('Order', 'create')`.
 * Сверяет его гард приложения по своей таблице прав.
 */
export const RequireRight = (resource: string, action: string | string[]) =>
  SetMetadata<string, IRightRequirement>(RIGHT_METADATA_KEY, { resource, action });
