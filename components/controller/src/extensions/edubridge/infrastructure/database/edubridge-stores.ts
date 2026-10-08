import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { EdubridgeAccessTaskRecord } from '../entities/edubridge-access-task.record';
import { EdubridgeAdminRecord } from '../entities/edubridge-admin.record';
import { EdubridgeConnectorBindingRecord } from '../entities/edubridge-connector-binding.record';
import { EdubridgeContributionRecord } from '../entities/edubridge-contribution.record';
import { EdubridgeCourseRecord } from '../entities/edubridge-course.record';
import { EdubridgeEnrollmentRecord } from '../entities/edubridge-enrollment.record';
import { EdubridgeGuaranteeClaimRecord } from '../entities/edubridge-guarantee-claim.record';
import { EdubridgeShareReturnRecord } from '../entities/edubridge-share-return.record';
import { EdubridgeLearnerRecord } from '../entities/edubridge-learner.record';
import { EdubridgeLessonRecord } from '../entities/edubridge-lesson.record';
import { EdubridgeLevelRecord } from '../entities/edubridge-level.record';
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
export const EDUBRIDGE_GUARANTEE_CLAIM_STORE = Symbol('Edubridge.EDUBRIDGE_GUARANTEE_CLAIM_STORE');
export const EDUBRIDGE_LEARNER_STORE = Symbol('Edubridge.EDUBRIDGE_LEARNER_STORE');
export const EDUBRIDGE_LESSON_STORE = Symbol('Edubridge.EDUBRIDGE_LESSON_STORE');
export const EDUBRIDGE_LEVEL_STORE = Symbol('Edubridge.EDUBRIDGE_LEVEL_STORE');
export const EDUBRIDGE_SECTION_STORE = Symbol('Edubridge.EDUBRIDGE_SECTION_STORE');
export const EDUBRIDGE_SHARE_RETURN_STORE = Symbol('Edubridge.EDUBRIDGE_SHARE_RETURN_STORE');
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
        columns: ['id', 'coopname', 'enrollment_id', 'kind', 'carrier', 'trigger_trx', 'recipient_override', 'status', 'attempts', 'next_attempt_at', 'last_error', 'last_result', 'done_at', 'created_at', 'updated_at'],
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
        columns: ['id', 'coopname', 'username', 'appointed_by', 'created_at'],
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
        columns: ['id', 'coopname', 'carrier', 'enabled', 'health', 'last_check_at', 'last_check_message', 'credentials_encrypted', 'credentials_updated_at', 'created_at', 'updated_at'],
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
        columns: ['id', 'coopname', 'teacher_username', 'assignment_id', 'rid_hash', 'rid_type', 'links', 'description', 'amount', 'status', 'statement_hash', 'storage_act_hash', 'storage_act_document', 'statement_document', 'hold_until', 'lesson_id', 'decision_hash', 'decision_document', 'act_hash', 'act_signed', 'decline_reason', 'council_project_hash', 'council_agenda_id', 'council_outcome', 'council_decision_id', 'decided_at', 'created_at', 'updated_at'],
        primaryKey: ['id'],
        json: ['links', 'statement_document', 'storage_act_document', 'decision_document', 'act_signed'],
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
        columns: ['id', 'coopname', 'chain_ref', 'title', 'section_id', 'level_id', 'subject', 'grade', 'description', 'syllabus', 'schedule', 'image', 'teacher_usernames', 'lessons_per_month', 'lessons_total', 'lesson_minutes', 'planned_hourly_rate', 'pay_per_learner', 'starts_at', 'guarantee_days', 'teacher_reserve_balance', 'teacher_settled_total', 'course_payment_enabled', 'course_discount_bp', 'fee_month', 'direction', 'carrier', 'external_ref', 'external_title_seen', 'external_checked_at', 'status', 'sort_order', 'created_at', 'updated_at'],
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
        columns: ['id', 'coopname', 'member_username', 'learner_id', 'course_id', 'sub_hash', 'period', 'paid_until', 'status', 'access_state', 'paid_amount', 'paid_months', 'locked_amount', 'joined_at', 'cancelled_at', 'refunded_amount', 'refund_reason', 'statement_hash', 'expiry_notified_at', 'created_at', 'updated_at', 'close_pending_since', 'close_error'],
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
        columns: ['id', 'coopname', 'chain_ref', 'member_username', 'display_name', 'recipient_type', 'recipient_value', 'is_self', 'created_at', 'updated_at'],
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
        columns: ['id', 'coopname', 'teacher_username', 'course_id', 'assignment_id', 'lesson_number', 'held_at', 'duration_minutes', 'materials', 'topic', 'contribution_id', 'learners_count', 'created_at'],
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
        columns: ['id', 'coopname', 'section_id', 'title', 'sort_order', 'archived', 'created_at', 'updated_at'],
        primaryKey: ['id'],
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
        columns: ['id', 'coopname', 'title', 'sort_order', 'archived', 'created_at', 'updated_at'],
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
        columns: ['id', 'coopname', 'chain_ref', 'teacher_username', 'course_id', 'schedule', 'expected_result', 'period_from', 'period_to', 'minutes_per_month', 'hourly_rate', 'status', 'created_at', 'updated_at'],
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
        columns: ['id', 'coopname', 'teacher_username', 'contract_hash', 'contract_number', 'contract_document', 'hourly_rate', 'status', 'decline_reason', 'approved_at', 'signed_at', 'updated_at'],
        primaryKey: ['id'],
        json: ['contract_document'],
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
        columns: ['id', 'coopname', 'teacher_username', 'about', 'hourly_rate', 'created_at', 'updated_at'],
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_GUARANTEE_CLAIM_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeGuaranteeClaimRecord>(db, {
        table: 'edubridge_guarantee_claims',
        columns: ['id', 'coopname', 'member_username', 'enrollment_id', 'course_id', 'claim_hash', 'reason', 'links', 'amount', 'status', 'statement_document', 'council_project_hash', 'council_agenda_id', 'council_decision_id', 'decision_hash', 'decided_at', 'created_at', 'updated_at'],
        primaryKey: ['id'],
        json: ['links', 'statement_document'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: EDUBRIDGE_SHARE_RETURN_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<EdubridgeShareReturnRecord>(db, {
        table: 'edubridge_share_returns',
        columns: ['id', 'coopname', 'teacher_username', 'amount', 'payment_hash', 'transfer_statement_document', 'return_statement_document', 'created_at', 'updated_at'],
        primaryKey: ['id'],
        json: ['transfer_statement_document', 'return_statement_document'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
];
