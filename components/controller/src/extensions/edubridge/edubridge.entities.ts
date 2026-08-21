/**
 * Таблицы, которыми владеет расширение «Образовательный мост».
 *
 * Список явный, а не глоб по диску: пакетно установленное расширение под глоб
 * ядра не попадает. Подключение — общее с ядром (как у capital), DDL через
 * `synchronize`.
 */
import {
  EdubridgeAccessTaskEntity,
  EdubridgeAdminEntity,
  EdubridgeConnectorBindingEntity,
  EdubridgeContributionEntity,
  EdubridgeCourseEntity,
  EdubridgeEnrollmentEntity,
  EdubridgeLearnerEntity,
  EdubridgeTeacherAssignmentEntity,
} from './infrastructure/entities';

export const edubridgeEntities = [
  EdubridgeCourseEntity,
  EdubridgeLearnerEntity,
  EdubridgeEnrollmentEntity,
  EdubridgeAccessTaskEntity,
  EdubridgeConnectorBindingEntity,
  EdubridgeTeacherAssignmentEntity,
  EdubridgeContributionEntity,
  EdubridgeAdminEntity,
] as const;
