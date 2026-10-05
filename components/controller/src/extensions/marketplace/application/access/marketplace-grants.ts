import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import { expandRights } from '@coopenomics/extension-kit';
import { rightsFor, type MarketplaceCondition } from './marketplace-access-matrix';

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
/** Развернуть права `Ресурс:действие` в набор для фронта: `:all` покрывает узкие охваты. */
export function expandGrants(rights: string[]): string[] {
  return expandRights(rights);
}

/** Все условия таблицы — для вопроса «что роли положено вообще». */
const ALL_CONDITIONS: ReadonlySet<MarketplaceCondition> = new Set<MarketplaceCondition>([
  'coop-accepted',
  'orderer-onboarded',
  'containers-enabled',
  'cells-enabled',
]);

/** Права ролей при всех выполненных условиях, развёрнутые для фронта. */
export function expandGrantsForRoles(roles: MarketplaceRole[]): string[] {
  return expandGrants(rightsFor(roles, ALL_CONDITIONS));
}
