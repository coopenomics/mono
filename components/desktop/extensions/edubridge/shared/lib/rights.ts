import { computed, type ComputedRef } from 'vue';
import { useDesktopStore } from 'src/entities/Desktop';

/** Стол администратора образования: под этим именем сервер выдаёт его права. */
const EDU_DESK = 'edubridge';

/**
 * Права записи на столе администратора образования. Стол читают член совета,
 * администратор и председатель; кнопки действий показываются по праву сервера:
 * курсы, допуски преподавателей и очередь ведёт администратор, деньги и
 * отклонение взноса — председатель.
 */
export function useEduRights(): {
  canManageCourses: ComputedRef<boolean>;
  canManageAssignments: ComputedRef<boolean>;
  canManageQueue: ComputedRef<boolean>;
  canManageEconomy: ComputedRef<boolean>;
  canDecide: ComputedRef<boolean>;
} {
  const desktop = useDesktopStore();
  const has = (grant: string) => computed(() => desktop.hasGrant(EDU_DESK, grant));
  return {
    canManageCourses: has('EduCourse:manage'),
    canManageAssignments: has('EduAssignment:manage'),
    canManageQueue: has('EduQueue:manage'),
    canManageEconomy: has('EduEconomy:manage'),
    canDecide: has('EduContribution:decide'),
  };
}
