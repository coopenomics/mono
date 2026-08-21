import type { EdubridgeRole } from '../membership/edubridge-roles.mapper';

/**
 * Матрица доступа «Образовательного моста»: роль → ресурс → действия.
 * Токен права — `Edu<Resource>:<action>[:<scope>]`; `:all` разворачивается в
 * `:own` (см. edubridge-grants.ts), поэтому владелец проходит требования пайщика.
 *
 * Контакты (`EduContacts`) и площадки с ключами (`EduConnector`) — только у
 * владельца; ограничение дублируется на уровне данных в резолверах.
 */
export const edubridgeAccessMatrix: Record<EdubridgeRole, Record<string, string[]>> = {
  guest: {
    EduCatalog: ['read'],
  },
  learner: {
    EduLearner: ['read:own', 'manage:own'],
    EduEnrollment: ['read:own', 'create:own'],
    EduAccess: ['read:own'],
  },
  teacher: {
    EduAssignment: ['read:own'],
    EduContribution: ['read:own', 'create:own'],
    EduTeacherWallet: ['read:own'],
  },
  admin: {
    EduCourse: ['manage'],
    EduRegistry: ['read'],
    EduQueue: ['read', 'manage'],
    EduAssignment: ['read:all', 'manage'],
    EduContribution: ['read:all', 'decide'],
  },
  owner: {
    EduCourse: ['manage'],
    EduRegistry: ['read'],
    EduQueue: ['read', 'manage'],
    EduAssignment: ['read:all', 'manage'],
    EduContribution: ['read:all', 'decide'],
    EduAdmin: ['manage'],
    EduContacts: ['read'],
    EduConnector: ['manage'],
    EduSettings: ['manage'],
  },
};

/** Охват действия: `:all` покрывает `:own`; без охвата — точное совпадение. */
function actionCovers(granted: string, required: string): boolean {
  if (granted === required) return true;
  const [gName, gScope] = granted.split(':');
  const [rName, rScope] = required.split(':');
  if (gName !== rName) return false;
  if (gScope === 'all') return true;
  return !gScope && !rScope;
}

/** Может ли набор ролей выполнить действие над ресурсом. Единственный источник policy на бэкенде. */
export function canAccess(roles: readonly EdubridgeRole[], resource: string, action: string | string[]): boolean {
  const required = Array.isArray(action) ? action : [action];
  for (const role of roles) {
    const granted = edubridgeAccessMatrix[role]?.[resource];
    if (!granted) continue;
    if (required.some((r) => granted.some((g) => actionCovers(g, r)))) return true;
  }
  return false;
}
