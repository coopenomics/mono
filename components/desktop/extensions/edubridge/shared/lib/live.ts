import { Ledger2Contract } from 'cooptypes';
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime';

const EDU = 'edubridge';
const table = (name: string): ChainTableRef => ({ code: EDU, table: name });

/**
 * Таблицы ленты изменений, из которых собраны экраны образования. Имена — те
 * же, что объявляет сервер (`edubridge-live-feed.service.ts`); кто получает
 * сигнал, решает сервер: личные таблицы — владелец строки и персонал.
 */
export const EduLive = {
  courses: table('edubridge_courses'),
  /** Группы курса: набор, дата начала, учёт средств группы. */
  groups: table('edubridge_groups'),
  sections: table('edubridge_sections'),
  levels: table('edubridge_levels'),
  enrollments: table('edubridge_enrollments'),
  guaranteeClaims: table('edubridge_guarantee_claims'),
  learners: table('edubridge_learners'),
  teacherContracts: table('edubridge_teacher_contracts'),
  assignments: table('edubridge_teacher_assignments'),
  lessons: table('edubridge_lessons'),
  contributions: table('edubridge_contributions'),
  /** Возвраты паевого взноса преподавателя — связка с платежом. */
  shareReturns: table('edubridge_share_returns'),
  /** Платежи шлюза: состояние возврата меняет совет и кассир. */
  payments: { code: 'core', table: 'payments' } as ChainTableRef,
  accessTasks: table('edubridge_access_tasks'),
  connectors: table('edubridge_connector_bindings'),
  /** Одобрения председателя: договоры и приложения преподавателей. */
  approvals: { code: 'chairman', table: 'chairman_approvals' } as ChainTableRef,
  /** Кошельки пайщиков: взносы, возвраты, расчёты преподавателя. */
  userWallets: liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
} as const;
