/**
 * Таблицы, которыми владеет расширение «Образовательный мост».
 *
 * Список явный, а не глоб по диску: пакетно установленное расширение под глоб
 * ядра не попадает. Подключение — общее с ядром (как у capital); таблицы
 * создают и меняют миграции расширения (`edubridge.database-migrations.ts`).
 */
import {
  EdubridgeAccessTaskEntity,
  EdubridgeAdminEntity,
  EdubridgeConnectorBindingEntity,
  EdubridgeContributionEntity,
  EdubridgeCourseEntity,
  EdubridgeEnrollmentEntity,
  EdubridgeLearnerEntity,
  EdubridgeLessonEntity,
  EdubridgeReturnRequestEntity,
  EdubridgeLevelEntity,
  EdubridgeSectionEntity,
  EdubridgeTeacherAssignmentEntity,
  EdubridgeTeacherContractEntity,
} from './infrastructure/entities';

export const edubridgeEntities = [
  EdubridgeCourseEntity,
  EdubridgeLearnerEntity,
  EdubridgeEnrollmentEntity,
  EdubridgeAccessTaskEntity,
  EdubridgeConnectorBindingEntity,
  EdubridgeTeacherAssignmentEntity,
  EdubridgeContributionEntity,
  EdubridgeLessonEntity,
  EdubridgeAdminEntity,
  EdubridgeTeacherContractEntity,
  EdubridgeReturnRequestEntity,
  EdubridgeSectionEntity,
  EdubridgeLevelEntity,
] as const;
