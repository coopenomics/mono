import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { EdubridgeAccessTaskEntity } from '../entities/edubridge-access-task.entity';
import { EdubridgeAdminEntity } from '../entities/edubridge-admin.entity';
import { EdubridgeConnectorBindingEntity } from '../entities/edubridge-connector-binding.entity';
import { EdubridgeContributionEntity } from '../entities/edubridge-contribution.entity';
import { EdubridgeCourseEntity } from '../entities/edubridge-course.entity';
import { EdubridgeEnrollmentEntity } from '../entities/edubridge-enrollment.entity';
import { EdubridgeLearnerEntity } from '../entities/edubridge-learner.entity';
import { EdubridgeLessonEntity } from '../entities/edubridge-lesson.entity';
import { EdubridgeLevelEntity } from '../entities/edubridge-level.entity';
import { EdubridgeReturnRequestEntity } from '../entities/edubridge-return-request.entity';
import { EdubridgeSectionEntity } from '../entities/edubridge-section.entity';
import { EdubridgeTeacherAssignmentEntity } from '../entities/edubridge-teacher-assignment.entity';
import { EdubridgeTeacherContractEntity } from '../entities/edubridge-teacher-contract.entity';
import { EdubridgeTeacherProfileEntity } from '../entities/edubridge-teacher-profile.entity';

/**
 * Шлюзы таблиц расширения: адаптеры хранилищ работают с записями целиком
 * (прочитал, поправил, сохранил), запросы к базе идут через Kysely.
 */
export const EDUBRIDGE_ACCESS_TASK_STORE = Symbol('Edubridge.EDUBRIDGE_ACCESS_TASK_STORE');
export const EDUBRIDGE_ADMIN_STORE = Symbol('Edubridge.EDUBRIDGE_ADMIN_STORE');
export const EDUBRIDGE_CONNECTOR_BINDING_STORE = Symbol('Edubridge.EDUBRIDGE_CONNECTOR_BINDING_STORE');
export const EDUBRIDGE_CONTRIBUTION_STORE = Symbol('Edubridge.EDUBRIDGE_CONTRIBUTION_STORE');
export const EDUBRIDGE_COURSE_STORE = Symbol('Edubridge.EDUBRIDGE_COURSE_STORE');
export const EDUBRIDGE_ENROLLMENT_STORE = Symbol('Edubridge.EDUBRIDGE_ENROLLMENT_STORE');
export const EDUBRIDGE_LEARNER_STORE = Symbol('Edubridge.EDUBRIDGE_LEARNER_STORE');
export const EDUBRIDGE_LESSON_STORE = Symbol('Edubridge.EDUBRIDGE_LESSON_STORE');
export const EDUBRIDGE_LEVEL_STORE = Symbol('Edubridge.EDUBRIDGE_LEVEL_STORE');
export const EDUBRIDGE_RETURN_REQUEST_STORE = Symbol('Edubridge.EDUBRIDGE_RETURN_REQUEST_STORE');
export const EDUBRIDGE_SECTION_STORE = Symbol('Edubridge.EDUBRIDGE_SECTION_STORE');
export const EDUBRIDGE_TEACHER_ASSIGNMENT_STORE = Symbol('Edubridge.EDUBRIDGE_TEACHER_ASSIGNMENT_STORE');
export const EDUBRIDGE_TEACHER_CONTRACT_STORE = Symbol('Edubridge.EDUBRIDGE_TEACHER_CONTRACT_STORE');
export const EDUBRIDGE_TEACHER_PROFILE_STORE = Symbol('Edubridge.EDUBRIDGE_TEACHER_PROFILE_STORE');

export const edubridgeStoreProviders: Provider[] = [
  {
    provide: EDUBRIDGE_ACCESS_TASK_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeAccessTaskEntity>(db, {
        table: 'edubridge_access_tasks',
        primaryKey: ['id'],
        json: ['recipient_override'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_ADMIN_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeAdminEntity>(db, {
        table: 'edubridge_admins',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_CONNECTOR_BINDING_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeConnectorBindingEntity>(db, {
        table: 'edubridge_connector_bindings',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_CONTRIBUTION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeContributionEntity>(db, {
        table: 'edubridge_contributions',
        primaryKey: ['id'],
        json: ['links', 'statement_document', 'act_signed'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_COURSE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeCourseEntity>(db, {
        table: 'edubridge_courses',
        primaryKey: ['id'],
        json: ['image', 'teacher_usernames'],
        dates: ['starts_at'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_ENROLLMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeEnrollmentEntity>(db, {
        table: 'edubridge_enrollments',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_LEARNER_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeLearnerEntity>(db, {
        table: 'edubridge_learners',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_LESSON_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeLessonEntity>(db, {
        table: 'edubridge_lessons',
        primaryKey: ['id'],
        json: ['materials'],
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_LEVEL_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeLevelEntity>(db, {
        table: 'edubridge_levels',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_RETURN_REQUEST_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeReturnRequestEntity>(db, {
        table: 'edubridge_return_requests',
        primaryKey: ['id'],
        json: ['statement_document'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_SECTION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeSectionEntity>(db, {
        table: 'edubridge_sections',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_TEACHER_ASSIGNMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeTeacherAssignmentEntity>(db, {
        table: 'edubridge_teacher_assignments',
        primaryKey: ['id'],
        dates: ['period_from', 'period_to'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_TEACHER_CONTRACT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeTeacherContractEntity>(db, {
        table: 'edubridge_teacher_contracts',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_TEACHER_PROFILE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeTeacherProfileEntity>(db, {
        table: 'edubridge_teacher_profiles',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
];
