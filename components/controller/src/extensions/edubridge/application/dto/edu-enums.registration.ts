import { registerEnumType } from '@nestjs/graphql';
import {
  EduAccessCarrier,
  EduAccessState,
  EduAccessTaskKind,
  EduAccessTaskStatus,
  EduAssignmentStatus,
  EduConnectorHealth,
  EduContractStatus,
  EduContributionStatus,
  EduCourseDirection,
  EduCourseStatus,
  EduEnrollmentPeriod,
  EduEnrollmentStatus,
  EduRecipientType,
  EduRidType,
} from '../../domain/enums';

registerEnumType(EduAccessCarrier, { name: 'EduAccessCarrier', description: 'Носитель доступа к курсу (площадка или очный формат)' });
registerEnumType(EduCourseDirection, { name: 'EduCourseDirection', description: 'Тип направления курса (внутренний признак)' });
registerEnumType(EduCourseStatus, { name: 'EduCourseStatus', description: 'Состояние курса в каталоге' });
registerEnumType(EduRecipientType, { name: 'EduRecipientType', description: 'Как доставляется пропуск обучающемуся' });
registerEnumType(EduEnrollmentPeriod, { name: 'EduEnrollmentPeriod', description: 'Период членского взноса' });
registerEnumType(EduEnrollmentStatus, { name: 'EduEnrollmentStatus', description: 'Состояние подписки обучающегося на курс' });
registerEnumType(EduAccessState, { name: 'EduAccessState', description: 'Состояние доступа на площадке' });
registerEnumType(EduAccessTaskKind, { name: 'EduAccessTaskKind', description: 'Вид задачи выдачи доступа' });
registerEnumType(EduAccessTaskStatus, { name: 'EduAccessTaskStatus', description: 'Состояние задачи очереди выдачи доступа' });
registerEnumType(EduConnectorHealth, { name: 'EduConnectorHealth', description: 'Состояние подключения площадки' });
registerEnumType(EduAssignmentStatus, { name: 'EduAssignmentStatus', description: 'Состояние назначения преподавателя' });
registerEnumType(EduContractStatus, { name: 'EduContractStatus', description: 'Состояние договора участия преподавателя в хозяйственной деятельности' });
registerEnumType(EduRidType, { name: 'EduRidType', description: 'Тип результата интеллектуальной деятельности' });
registerEnumType(EduContributionStatus, { name: 'EduContributionStatus', description: 'Состояние взноса результатами работы' });
