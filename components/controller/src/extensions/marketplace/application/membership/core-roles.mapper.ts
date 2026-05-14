/**
 * Маппер core-ролей пайщика из единственной `user.role` (строка из JWT
 * payload, см. `JwtAuthStrategy.validate`) в массив core-ролей платформы.
 *
 * Иерархия (см. memory `reference_core_controller_roli`):
 *   `user`      — обычный пайщик → ['User'].
 *   `member`    — член совета (тоже пайщик) → ['User', 'Member'].
 *   `chairman`  — председатель (входит в совет) → ['User', 'Member', 'Chairman'].
 *   прочее (`admin`/неизвестное) — не кооперативная роль → [].
 *
 * Story 1.6 дополнит этим маппером `MarketplaceMembershipGuard`, а сам
 * массив будет использоваться access-matrix (Story 1.8) для проверок
 * прав, не дублируя core-логику.
 */

export type CoreRole = 'User' | 'Member' | 'Chairman';

const ROLE_TO_CORE: Record<string, CoreRole[]> = {
  user: ['User'],
  member: ['User', 'Member'],
  chairman: ['User', 'Member', 'Chairman'],
};

export function mapUserRoleToCoreRoles(userRole: string | undefined | null): CoreRole[] {
  if (!userRole) return [];
  return ROLE_TO_CORE[userRole] ?? [];
}
