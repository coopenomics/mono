import type { EdubridgeRole } from '../membership/edubridge-roles.mapper';
import { edubridgeAccessMatrix } from './edubridge-access-matrix';

/**
 * Разворачивает роли пайщика в плоский набор прав `Resource:action[:scope]`.
 * Фронт сверяет `meta.requires` простым `includes`.
 *
 * Охват `:all` в `:own` не разворачивается: на правах `:own` стоят страницы
 * личных столов — ученика и преподавателя, а их открывает подписанная оферта
 * (и договор у преподавателя), а не должность. Иначе председатель и
 * администратор программы видели бы стол преподавателя целиком, не
 * подключившись к преподаванию.
 */
export function expandGrantsForRoles(roles: EdubridgeRole[]): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    const resources = edubridgeAccessMatrix[role];
    if (!resources) continue;
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) set.add(`${resource}:${action}`);
    }
  }
  return [...set];
}
