/**
 * Core-роли пайщика из единственной `user.role` (строка из JWT).
 *
 *   `user`     — обычный пайщик → ['User'].
 *   `member`   — член совета → ['User', 'Member'].
 *   `chairman` — председатель → ['User', 'Member', 'Chairman'].
 *   прочее — не кооперативная роль → [].
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
