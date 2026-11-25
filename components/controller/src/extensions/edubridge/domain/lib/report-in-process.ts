import { EduContributionStatus, EduLessonStatus } from '../enums';
import { eduDaySeconds } from '../economy/time-scale';

/**
 * Процесс отчёта по занятию не завершён — расчёты по подпискам группы
 * закрывать рано (решение владельца 25.11.2026).
 *
 * Пока процесс идёт, ученикам может понадобиться вернуть оплату занятия
 * (`refundlesson` при отказе совета), а преподавателю — подать отчёт заново
 * (`chargelesson` снова спишет оплату). Обе операции работают только по живым
 * подпискам в цепи: закрытая подписка пропускается, и повторный отчёт по
 * завершённой группе невозможен. Раньше подписки закрывались по минутам
 * программы, открытым в цепи, — в их число входил и отчёт на рассмотрении совета.
 *
 * Процесс не завершён, если по занятию:
 *  - взнос в работе: черновик, материалы на хранении, заявление в совете;
 *  - отчёт гарантийного срока ждёт оформления взноса;
 *  - совет отклонил взнос, срок на отчёт группы после отказа не вышел, а
 *    повторного отчёта нет (у повторного — свой новый взнос).
 */
export interface LessonReportState {
  status: EduLessonStatus | string;
  contribution_id: string | null;
  learners_count: number | null;
}

export interface ContributionDecisionState {
  status: EduContributionStatus | string;
  decided_at: Date | string | null;
}

const IN_WORK: ReadonlySet<string> = new Set([
  EduContributionStatus.DRAFT,
  EduContributionStatus.HELD,
  EduContributionStatus.SUBMITTED,
]);

export function lessonReportInProcess(
  lesson: LessonReportState,
  contribution: ContributionDecisionState | null,
  reportDays: number,
  now: Date = new Date()
): boolean {
  if (lesson.status !== EduLessonStatus.HELD) return false;
  // Отчёт гарантийного срока: взнос по нему заведут после срока.
  if (!lesson.contribution_id) return Number(lesson.learners_count ?? 0) > 0;
  if (!contribution) return false;
  if (IN_WORK.has(contribution.status)) return true;
  if (contribution.status !== EduContributionStatus.DECLINED || !contribution.decided_at) return false;
  const windowMs = Math.max(0, Number(reportDays ?? 0)) * eduDaySeconds() * 1000;
  return new Date(contribution.decided_at).getTime() + windowMs > now.getTime();
}
