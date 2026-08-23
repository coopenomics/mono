import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import { marketplaceAccessMatrix } from './marketplace-access-matrix';

/**
 * Канон авторизации столов: разворачивает marketplace-роли пайщика в плоский
 * набор capability-токенов `Resource:action` для фронта.
 *
 * Зачем разворачивать здесь, а не на фронте: фронт сверяет требование маршрута
 * (`meta.requires`) с грантами простым `includes`, без знания иерархии охвата.
 * Поэтому право `<...>:all` (над всеми объектами) разворачивается в подмножества
 * `:own` / `:own-KU` / `:to-self` — ровно та же иерархия, что в `canAccess`
 * (`marketplace-access-matrix.ts`). Так у админа (`Warehouse:read:all`) проходит
 * требование оператора (`Warehouse:read:own-KU`), а вся policy живёт на backend.
 */
const SUBSET_QUALIFIERS = ['own', 'own-KU', 'to-self'];

function expandToken(token: string): string[] {
  const out = [token];
  const colon = token.lastIndexOf(':');
  if (colon > 0 && token.slice(colon + 1) === 'all') {
    const prefix = token.slice(0, colon); // напр. 'Warehouse:read'
    for (const q of SUBSET_QUALIFIERS) out.push(`${prefix}:${q}`);
  }
  return out;
}

export function expandGrantsForRoles(roles: MarketplaceRole[]): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    const resources = marketplaceAccessMatrix[role];
    if (!resources) continue;
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) {
        for (const token of expandToken(`${resource}:${action}`)) set.add(token);
      }
    }
  }
  return [...set];
}
