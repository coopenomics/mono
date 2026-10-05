import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { EdubridgeAccessTaskRecord } from '../entities/edubridge-access-task.record';
import { EdubridgeAdminRecord } from '../entities/edubridge-admin.record';
import { EdubridgeConnectorBindingRecord } from '../entities/edubridge-connector-binding.record';
import { EdubridgeContributionRecord } from '../entities/edubridge-contribution.record';
import { EdubridgeCourseRecord } from '../entities/edubridge-course.record';
import { EdubridgeEnrollmentRecord } from '../entities/edubridge-enrollment.record';
import { EdubridgeLearnerRecord } from '../entities/edubridge-learner.record';
import { EdubridgeLessonRecord } from '../entities/edubridge-lesson.record';
import { EdubridgeLevelRecord } from '../entities/edubridge-level.record';
import { EdubridgeReturnRequestRecord } from '../entities/edubridge-return-request.record';
import { EdubridgeSectionRecord } from '../entities/edubridge-section.record';
import { EdubridgeTeacherAssignmentRecord } from '../entities/edubridge-teacher-assignment.record';
import { EdubridgeTeacherContractRecord } from '../entities/edubridge-teacher-contract.record';
import { EdubridgeTeacherProfileRecord } from '../entities/edubridge-teacher-profile.record';

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
      new TableStore<EdubridgeAccessTaskRecord>(db, {
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
      new TableStore<EdubridgeAdminRecord>(db, {
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
      new TableStore<EdubridgeConnectorBindingRecord>(db, {
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
      new TableStore<EdubridgeContributionRecord>(db, {
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
      new TableStore<EdubridgeCourseRecord>(db, {
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
      new TableStore<EdubridgeEnrollmentRecord>(db, {
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
      new TableStore<EdubridgeLearnerRecord>(db, {
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
      new TableStore<EdubridgeLessonRecord>(db, {
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
      new TableStore<EdubridgeLevelRecord>(db, {
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
      new TableStore<EdubridgeReturnRequestRecord>(db, {
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
      new TableStore<EdubridgeSectionRecord>(db, {
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
      new TableStore<EdubridgeTeacherAssignmentRecord>(db, {
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
      new TableStore<EdubridgeTeacherContractRecord>(db, {
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
      new TableStore<EdubridgeTeacherProfileRecord>(db, {
        table: 'edubridge_teacher_profiles',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
];
