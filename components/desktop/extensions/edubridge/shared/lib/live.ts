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
  enrollments: table('edubridge_enrollments'),
  learners: table('edubridge_learners'),
  returnRequests: table('edubridge_return_requests'),
  teacherContracts: table('edubridge_teacher_contracts'),
  assignments: table('edubridge_teacher_assignments'),
  lessons: table('edubridge_lessons'),
  contributions: table('edubridge_contributions'),
  accessTasks: table('edubridge_access_tasks'),
  connectors: table('edubridge_connector_bindings'),
  admins: table('edubridge_admins'),
  /** Одобрения председателя: договоры и приложения преподавателей. */
  approvals: { code: 'chairman', table: 'chairman_approvals' } as ChainTableRef,
  /** Кошельки пайщиков: взносы, возвраты, расчёты преподавателя. */
  userWallets: liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
} as const;
