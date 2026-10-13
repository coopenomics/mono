import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { t } from '../../i18n';

/**
 * Занятие группы: календарь и журнал в одной записи. Занятие появляется из
 * окон расписания либо назначается администратором отдельно, живёт в календаре
 * запланированным, отчёт преподавателя переводит его в проведённое.
 */
export type ICalendarLesson = Queries.Edubridge.LessonCalendar.IOutput[typeof Queries.Edubridge.LessonCalendar.name][number];
export type ILessonCalendarFilter = NonNullable<Queries.Edubridge.LessonCalendar.IInput['filter']>;
export type IPlanLessonInput = Mutations.Edubridge.PlanLesson.IInput['data'];
export type IMoveLessonInput = Mutations.Edubridge.MoveLesson.IInput['data'];
/** Окно расписания: день недели, время начала, длительность и допуск преподавателя. */
export interface IScheduleSlot {
  weekday: number;
  time: string;
  minutes: number;
  assignment_id: string | null;
}

/** Состояние занятия словами; просроченное — запланированное, у которого вышел срок на отчёт. */
export const LESSON_STATE_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduLessonStatus.PLANNED]: { label: t('edubridge.lesson.state.planned'), variant: 'info' },
  [Zeus.EduLessonStatus.HELD]: { label: t('edubridge.lesson.state.held'), variant: 'pos' },
  [Zeus.EduLessonStatus.CANCELLED]: { label: t('edubridge.lesson.state.cancelled'), variant: 'neutral' },
  overdue: { label: t('edubridge.lesson.state.overdue'), variant: 'warn' },
};

export function lessonStateOf(l: Pick<ICalendarLesson, 'status' | 'overdue'>): { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' } {
  if (l.overdue) return LESSON_STATE_LABELS.overdue;
  return LESSON_STATE_LABELS[l.status] ?? { label: String(l.status), variant: 'neutral' };
}

/** Отчёт по занятию открыт: занятие закончилось, срок на отчёт не вышел. */
export function isReportable(l: Pick<ICalendarLesson, 'status' | 'ends_at' | 'report_until'>, now: Date = new Date()): boolean {
  return l.status === Zeus.EduLessonStatus.PLANNED && new Date(String(l.ends_at)) <= now && new Date(String(l.report_until)) >= now;
}

export async function fetchLessonCalendar(filter: ILessonCalendarFilter = {}): Promise<ICalendarLesson[]> {
  const { [Queries.Edubridge.LessonCalendar.name]: result } = await client.Query(Queries.Edubridge.LessonCalendar.query, { variables: { filter } });
  return result;
}

export async function fetchGroupLessons(group_id: string): Promise<ICalendarLesson[]> {
  const { [Queries.Edubridge.GroupLessons.name]: result } = await client.Query(Queries.Edubridge.GroupLessons.query, { variables: { group_id } });
  return result;
}

export async function planLesson(data: IPlanLessonInput): Promise<ICalendarLesson> {
  const { [Mutations.Edubridge.PlanLesson.name]: result } = await client.Mutation(Mutations.Edubridge.PlanLesson.mutation, { variables: { data } });
  return result;
}

export async function moveLesson(data: IMoveLessonInput): Promise<ICalendarLesson> {
  const { [Mutations.Edubridge.MoveLesson.name]: result } = await client.Mutation(Mutations.Edubridge.MoveLesson.mutation, { variables: { data } });
  return result;
}

export async function cancelLesson(lesson_id: string): Promise<ICalendarLesson> {
  const { [Mutations.Edubridge.CancelLesson.name]: result } = await client.Mutation(Mutations.Edubridge.CancelLesson.mutation, { variables: { lesson_id } });
  return result;
}

/** Дни недели коротко: 1 — понедельник … 7 — воскресенье. */
export const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((value) => ({ value, label: t(`edubridge.schedule.weekday.${value}` as never) }));

/** Момент занятия словами: «Чт 15.10, 17:00». */
export function formatLessonMoment(value: unknown): string {
  if (!value) return '______';
  const d = new Date(String(value));
  return `${WEEKDAY_OPTIONS[((d.getDay() + 6) % 7)].label} ${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}
