import type { EdubridgeRole } from '../membership/edubridge-roles.mapper';
import { edubridgeAccessMatrix } from './edubridge-access-matrix';

/**
 * Разворачивает роли пайщика в плоский набор прав `Resource:action[:scope]`.
 * Фронт сверяет `meta.requires` простым `includes`, иерархию охвата он не знает,
 * поэтому `<...>:all` разворачивается здесь в `:own`.
 */
const SUBSET_QUALIFIERS = ['own'];

function expandToken(token: string): string[] {
  const out = [token];
  const colon = token.lastIndexOf(':');
  if (colon > 0 && token.slice(colon + 1) === 'all') {
    const prefix = token.slice(0, colon);
    for (const q of SUBSET_QUALIFIERS) out.push(`${prefix}:${q}`);
  }
  return out;
}

export function expandGrantsForRoles(roles: EdubridgeRole[]): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    const resources = edubridgeAccessMatrix[role];
    if (!resources) continue;
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) {
        for (const token of expandToken(`${resource}:${action}`)) set.add(token);
      }
    }
  }
  return [...set];
}
