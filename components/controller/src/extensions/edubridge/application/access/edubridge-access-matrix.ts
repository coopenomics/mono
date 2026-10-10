import type { EdubridgeRole } from '../membership/edubridge-roles.mapper';

/** Ключ назначаемой роли администратора образования — он же строка таблицы прав. */
export const EDU_ADMIN_ROLE = 'edu-admin';

/**
 * Матрица доступа «Образовательного моста»: роль → ресурс → действия.
 * Токен права — `Edu<Resource>:<action>[:<scope>]`. На сервере `:all` покрывает
 * `:own` (см. `canAccess`); столу права отдаются как записаны, без разворота —
 * личные столы открывает подключение, а не должность (см. edubridge-grants.ts).
 *
 * Контакты (`EduContacts`) и площадки с ключами (`EduConnector`) — только у
 * владельца; ограничение дублируется на уровне данных в резолверах.
 */
/**
 * Чтение стола администратора: курсы и группы, ученики, очередь доступа,
 * допуски преподавателей, взносы результатами работы, деньги программы.
 * Его получают член совета, администратор образования и председатель.
 */
const STAFF_READ: Record<string, string[]> = {
  EduCourse: ['read'],
  EduRegistry: ['read'],
  EduQueue: ['read'],
  EduAssignment: ['read:all'],
  EduContribution: ['read:all'],
  EduEconomy: ['read'],
};

export const edubridgeAccessMatrix: Record<EdubridgeRole, Record<string, string[]>> = {
  guest: {
    EduCatalog: ['read'],
  },
  learner: {
    EduLearner: ['read:own', 'manage:own'],
    EduEnrollment: ['read:own', 'create:own'],
    EduAccess: ['read:own'],
    EduReturn: ['read:own'],
  },
  teacher: {
    EduAssignment: ['read:own'],
    EduContribution: ['read:own', 'create:own'],
    EduTeacherWallet: ['read:own', 'manage:own'],
  },
  council: STAFF_READ,
  'edu-admin': {
    ...STAFF_READ,
    EduCourse: ['read', 'manage'],
    EduQueue: ['read', 'manage'],
    EduAssignment: ['read:all', 'manage'],
  },
  owner: {
    ...STAFF_READ,
    EduCourse: ['read', 'manage'],
    EduQueue: ['read', 'manage'],
    EduAssignment: ['read:all', 'manage'],
    // Деньги и решения по существу — только председатель: ставки часа,
    // целевой взнос, расходы программы, отклонение взноса результатом работы.
    EduContribution: ['read:all', 'decide'],
    EduEconomy: ['read', 'manage'],
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
