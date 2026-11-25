import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { getTimezone, getTimezoneLabel } from 'src/shared/lib/utils/dates';
import { t } from '../../i18n';

/**
 * Время занятий — местное время кооператива: по его поясу сервер строит
 * календарь из окон расписания. Стол показывает моменты занятий в том же
 * поясе и подписывает его («МСК»): иначе ученик в другом поясе видел бы в
 * календаре 21:00 при расписании «Вт 17:00» (замечание владельца 25.11.2026).
 */
export const COOP_TIMEZONE_LABEL = getTimezoneLabel();
const coopFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: getTimezone(),
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Момент по часам кооператива: год, месяц с нуля, число, день недели (1 — пн … 7 — вс) и «ЧЧ:ММ». */
export function coopMoment(value: unknown): { year: number; month: number; day: number; weekday: number; time: string } {
  const parts = Object.fromEntries(coopFormat.formatToParts(new Date(String(value))).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month) - 1;
  const day = Number(parts.day);
  const weekday = ((new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7) + 1;
  return { year, month, day, weekday, time: `${parts.hour}:${parts.minute}` };
}

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

/** Срок с годом и временем: «05.11.2026, 17:03 МСК» — срок может лежать за пределами текущего года. */
export function formatDeadline(value: unknown): string {
  if (!value) return '______';
  const m = coopMoment(value);
  return `${pad(m.day)}.${pad(m.month + 1)}.${m.year}, ${m.time} ${COOP_TIMEZONE_LABEL}`;
}

/** Момент занятия словами: «Чт 15.10, 17:00 МСК». */
export function formatLessonMoment(value: unknown): string {
  if (!value) return '______';
  const m = coopMoment(value);
  return `${WEEKDAY_OPTIONS[m.weekday - 1].label} ${pad(m.day)}.${pad(m.month + 1)}, ${m.time} ${COOP_TIMEZONE_LABEL}`;
}

const pad = (n: number): string => String(n).padStart(2, '0');
