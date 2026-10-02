/** Роли совета кооператива: председатель и члены совета. */
export const COUNCIL_ROLES: readonly string[] = ['chairman', 'member'];

/** Состоит ли роль в совете. */
export function isCouncilRole(role: string | null | undefined): boolean {
  return COUNCIL_ROLES.includes(String(role ?? ''));
}
