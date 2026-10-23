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
/** Окно расписания: день недели, время начала, длительность, стоимость часа преподавателя и допуск преподавателя. */
export interface IScheduleSlot {
  weekday: number;
  time: string;
  minutes: number;
  assignment_id: string | null;
  /** Плановая стоимость часа преподавателя в окне: в форме — число, на сервер — сумма с символом. Членский взнос кооператива в неё не входит. */
  hourly_rate: string;
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

/** Занятие запланировано и закончилось. */
export function hasEnded(l: Pick<ICalendarLesson, 'status' | 'ends_at'>, now: Date = new Date()): boolean {
  return l.status === Zeus.EduLessonStatus.PLANNED && new Date(String(l.ends_at)) <= now;
}

/**
 * Отчёт по занятию открыт: занятие закончилось, и на его дату в группе есть
 * обучающиеся с оплаченным доступом. Без них рассчитывать занятие не с кем —
 * отчёта не ждут. Просрочка показывается, приём не держит.
 */
export function isReportable(l: Pick<ICalendarLesson, 'status' | 'ends_at' | 'learners_paid'>, now: Date = new Date()): boolean {
  return hasEnded(l, now) && Number(l.learners_paid) > 0;
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

/** «Восьмой день» окна — резерв: минуты входят в программу, занятие из них назначает администратор. */
export const RESERVE_WEEKDAY = 8;

/** Дни недели коротко: 1 — понедельник … 7 — воскресенье. */
export const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((value) => ({ value, label: t(`edubridge.schedule.weekday.${value}` as never) }));

/** Срок с годом и временем: «05.11.2026, 17:03» — срок может лежать за пределами текущего года. */
export function formatDeadline(value: unknown): string {
  if (!value) return '______';
  const d = new Date(String(value));
  return `${d.toLocaleDateString('ru-RU')}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Момент занятия словами: «Чт 15.10, 17:00». */
export function formatLessonMoment(value: unknown): string {
  if (!value) return '______';
  const d = new Date(String(value));
  return `${WEEKDAY_OPTIONS[((d.getDay() + 6) % 7)].label} ${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}
