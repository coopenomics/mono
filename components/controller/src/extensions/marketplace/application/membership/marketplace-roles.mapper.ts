import type { CoreRole } from './core-roles.mapper';

/**
 * Marketplace-роли — массивные (Array.includes), не enum.
 *
 * Phase 2 уйдёт в платформенный CASL (`defineAbility`) — поведение Guard
 * не изменится, только источник policy сменится с access-matrix.ts на
 * CASL-abilities. См. README рядом с guard.
 */
export type MarketplaceRole =
  | 'orderer'        // Любой пайщик: оформляет заказ
  | 'offerer'        // Одобренный поставщик из реестра: публикует предложения
  | 'operator'       // Председатель КУ (Эпик 2): операции по своему КУ
  | 'board_readonly' // Member: read-only к admin-данным
  | 'board'          // Chairman: полные права в повестке совета
  | 'admin';         // Chairman: full admin

/**
 * Контекст для расширенных marketplace-ролей.
 *
 * `isOfferer` (реестр поставщиков) — допущенный поставщик либо сам кооператив,
 * `MarketplaceSupplierRegistryService.isOfferer`.
 *
 * `isKuChairman` — Эпик 2 (ПВЗ): пайщик имеет операционные полномочия
 * на хотя бы одном КУ кооператива. Источник — `MarketplaceKuChairmanService.isKuChairman`,
 * семантика «trustee ИЛИ trusted одного из branches» (trustee и trusted
 * равны в правах по столу ПВЗ — приёмка, выдача, маркировка, склад).
 */
export interface IMarketplaceRoleContext {
  isOfferer?: boolean;
  isKuChairman?: boolean;
}

/**
 * Маппинг core_roles[] + context → marketplace_roles[].
 *
 * Аддитивный:
 *   `User` (всегда у пайщика, см. core-roles.mapper)        → [orderer]
 *   + opts.isOfferer                                        → +offerer
 *   + opts.isKuChairman                                     → +operator
 *   `Member` (в core)                                       → +board_readonly
 *   `Chairman` (в core)                                     → +admin, +board
 *
 * Пайщик БЕЗ `User` в core_roles (admin-роль платформы или невалидное
 * состояние) → marketplace_roles = []. Guard вышестоящего уровня
 * (`MarketplaceMembershipGuard`) такого пайщика уже отбросит 403, но
 * mapper остаётся пуристичным.
 */
export function mapCoreRolesToMarketplaceRoles(
  coreRoles: CoreRole[],
  context: IMarketplaceRoleContext = {}
): MarketplaceRole[] {
  if (!coreRoles.includes('User')) {
    return [];
  }

  const roles: MarketplaceRole[] = ['orderer'];

  if (context.isOfferer) roles.push('offerer');
  if (context.isKuChairman) roles.push('operator');

  if (coreRoles.includes('Member')) {
    roles.push('board_readonly');
  }

  if (coreRoles.includes('Chairman')) {
    roles.push('admin');
    roles.push('board');
  }

  return roles;
}
