import type { CoreRole } from './core-roles.mapper';

/**
 * Роли «Образовательного моста». Массив, не enum: пайщик может быть сразу
 * родителем-слушателем и преподавателем.
 *
 *   guest    — любой посетитель, в том числе неавторизованный: каталог курсов.
 *   learner  — пайщик, подписавший оферту родителя-слушателя: обучающиеся и подписки.
 *   teacher  — пайщик, подписавший оферту преподавателя и ДУХД: назначения и взносы РИД.
 *   admin    — администратор (таблица edubridge_admins) или член совета: реестры, очередь, курсы.
 *   owner    — председатель: всё, что admin, плюс контакты, площадки и ключи, настройка.
 */
export type EdubridgeRole = 'guest' | 'learner' | 'teacher' | 'admin' | 'owner';

export interface EdubridgeRoleFacts {
  isLearner: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
}

export function mapCoreRolesToEdubridgeRoles(coreRoles: CoreRole[], facts: EdubridgeRoleFacts): EdubridgeRole[] {
  const roles: EdubridgeRole[] = ['guest'];
  if (coreRoles.length === 0) return roles;
  if (facts.isLearner) roles.push('learner');
  if (facts.isTeacher) roles.push('teacher');
  if (facts.isAdmin || coreRoles.includes('Member')) roles.push('admin');
  if (coreRoles.includes('Chairman')) roles.push('owner');
  return roles;
}
