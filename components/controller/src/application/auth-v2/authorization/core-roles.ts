/**
 * Платформенный маппер core-ролей пайщика из единственной `user.role` (строка из
 * JWT payload, см. `JwtAuthStrategy.validate`) в массив core-ролей платформы.
 *
 * Иерархия (CLAUDE.md «3 базовые роли — User / Member / Chairman»):
 *   `user`      — обычный пайщик → ['User'].
 *   `member`    — член совета (тоже пайщик) → ['User', 'Member'].
 *   `chairman`  — председатель (входит в совет) → ['User', 'Member', 'Chairman'].
 *   прочее (`admin`/неизвестное) — не кооперативная роль → [].
 *
 * Зеркало зачатка с ветки `marketplace2`
 * (`extensions/marketplace/application/membership/core-roles.mapper.ts`), поднятое
 * на платформенный уровень: общий фундамент ролей для CASL-авторизации auth-v2
 * (Story 6.1) и marketplace-matrix. Marketplace-маппер позже сконсолидируется сюда.
 */

export type CoreRole = 'User' | 'Member' | 'Chairman';

const ROLE_TO_CORE: Record<string, CoreRole[]> = {
  user: ['User'],
  member: ['User', 'Member'],
  chairman: ['User', 'Member', 'Chairman'],
};

export function mapUserRoleToCoreRoles(userRole: string | undefined | null): CoreRole[] {
  if (!userRole) {
    return [];
  }
  return ROLE_TO_CORE[userRole] ?? [];
}
