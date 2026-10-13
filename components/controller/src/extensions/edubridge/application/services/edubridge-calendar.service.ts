import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EduAssignmentStatus, EduGroupStatus, EduLessonOrigin, EduLessonStatus } from '../../domain/enums';
import type { EdubridgeGroupRecord, EdubridgeLessonRecord, EdubridgeTeacherAssignmentRecord } from '../../infrastructure/entities';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeGroupKyselyRepository } from '../../infrastructure/repositories/edubridge-group.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { EdubridgeTeacherKyselyRepository } from '../../infrastructure/repositories/edubridge-teacher.kysely-repository';
import { eduMonthSeconds, isTimeCompressed } from '../../domain/economy/time-scale';
import { type EduScheduleSlot, type SlotOccurrence, normalizeSlots, slotOccurrences } from '../../domain/lib/schedule';
import { startMomentOf } from '../../domain/lib/group-start';

export interface EduScheduleInput {
  group_id: string;
  slots: Partial<EduScheduleSlot>[];
  report_days?: number | null;
}

export interface EduPlanLessonInput {
  group_id: string;
  held_at: string;
  minutes?: number | null;
  assignment_id?: string | null;
  topic?: string | null;
}

export interface EduMoveLessonInput {
  lesson_id: string;
  held_at?: string | null;
  minutes?: number | null;
  assignment_id?: string | null;
  topic?: string | null;
}

export interface EduCalendarFilter {
  course_id?: string | null;
  group_id?: string | null;
  teacher_username?: string | null;
  from?: string | null;
  to?: string | null;
}

/** Горизонт календаря у программы без конечного числа занятий — месяцев вперёд. */
const OPEN_PROGRAM_MONTHS = 3;

/**
 * Календарь занятий группы. Окна расписания и дата начала дают занятия
 * заранее: они лежат в журнале как запланированные, преподаватель
 * отчитывается по ним, администратор переносит, отменяет и добавляет занятия
 * сверх расписания. Программа курса — предел: занятий в календаре столько,
 * сколько занятий в программе; дополнительное занятие занимает место
 * последних запланированных по расписанию.
 */
@Injectable()
export class EdubridgeCalendarService {
  constructor(
    private readonly lessons: EdubridgeLessonKyselyRepository,
    private readonly groups: EdubridgeGroupKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly teachers: EdubridgeTeacherKyselyRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeCalendarService.name);
  }

  /** Окна расписания группы и срок на отчёт; календарь перестраивается. */
  async setSchedule(coopname: string, input: EduScheduleInput): Promise<EdubridgeGroupRecord> {
    const group = await this.group(coopname, input.group_id);
    const slots = normalizeSlots(input.slots);
    for (const slot of slots) if (slot.assignment_id) await this.courseAssignment(coopname, group.course_id, slot.assignment_id);
    group.schedule_slots = slots;
    if (input.report_days !== undefined && input.report_days !== null) group.report_days = reportDaysOf(input.report_days);
    const saved = await this.groups.save(group);
    await this.rebuild(coopname, saved);
    return saved;
  }

  /**
   * Перестроить занятия из окон расписания. Проведённые, отменённые и
   * назначенные отдельно занятия остаются; запланированные по расписанию
   * стираются и строятся заново от даты начала в пределах программы.
   */
  async rebuild(coopname: string, group: EdubridgeGroupRecord): Promise<EdubridgeLessonRecord[]> {
    const all = await this.lessons.findByGroup(coopname, group.id);
    const planned = all.filter((l) => l.status === EduLessonStatus.PLANNED && l.origin === EduLessonOrigin.SCHEDULE);
    await this.lessons.deleteMany(planned.map((l) => l.id));
    const kept = all.filter((l) => !planned.includes(l));
    const start = startMomentOf(group);
    if (!start || !group.schedule_slots?.length || group.status !== EduGroupStatus.ACTIVE) return kept;

    const budget = this.budget(group, kept);
    const occurrences = isTimeCompressed()
      ? compressedOccurrences(group, new Date(start), budget)
      : slotOccurrences(group.schedule_slots, new Date(start), budget);
    const assignments = new Map<string, EdubridgeTeacherAssignmentRecord | null>();
    const created: EdubridgeLessonRecord[] = [];
    let used = 0;
    const taken = new Set(kept.filter((l) => l.status !== EduLessonStatus.CANCELLED).map((l) => l.lesson_number));
    for (const { at, slot } of occurrences) {
      const minutes = Number(slot.minutes);
      if (used + minutes > budget) break;
      const assignment = slot.assignment_id ? await this.cached(assignments, coopname, slot.assignment_id) : null;
      const number = nextFree(taken);
      taken.add(number);
      used += minutes;
      created.push(
        await this.lessons.save(
          this.lessons.create({
            coopname,
            course_id: group.course_id,
            group_id: group.id,
            lesson_number: number,
            held_at: at,
            duration_minutes: slot.minutes,
            status: EduLessonStatus.PLANNED,
            origin: EduLessonOrigin.SCHEDULE,
            reported_at: null,
            assignment_id: assignment?.id ?? null,
            teacher_username: assignment?.teacher_username ?? null,
            materials: [],
            topic: '',
            contribution_id: null,
            learners_count: null,
          })
        )
      );
    }
    this.logger.info(`[EDU.CAL] группа «${group.title}»: по расписанию запланировано занятий ${created.length}`);
    return [...kept, ...created].sort(byDate);
  }

  /**
   * Занятие сверх расписания: администратор называет дату, длительность и
   * преподавателя. Место в программе берётся у последних запланированных по
   * расписанию занятий; без них — программа заполнена.
   */
  async plan(coopname: string, input: EduPlanLessonInput): Promise<EdubridgeLessonRecord> {
    const group = await this.group(coopname, input.group_id);
    const at = momentOf(input.held_at);
    const minutes = minutesOf(input.minutes, group.lesson_minutes);
    const assignment = input.assignment_id ? await this.courseAssignment(coopname, group.course_id, input.assignment_id) : null;
    const all = await this.lessons.findByGroup(coopname, group.id);
    await this.makeRoom(group, all, minutes);
    const live = all.filter((l) => l.status !== EduLessonStatus.CANCELLED);
    const number = nextFree(new Set(live.map((l) => l.lesson_number)));
    const lesson = await this.lessons.save(
      this.lessons.create({
        coopname,
        course_id: group.course_id,
        group_id: group.id,
        lesson_number: number,
        held_at: at,
        duration_minutes: minutes,
        status: EduLessonStatus.PLANNED,
        origin: EduLessonOrigin.EXTRA,
        reported_at: null,
        assignment_id: assignment?.id ?? null,
        teacher_username: assignment?.teacher_username ?? null,
        materials: [],
        topic: input.topic?.trim() ?? '',
        contribution_id: null,
        learners_count: null,
      })
    );
    this.logger.info(`[EDU.CAL] группа «${group.title}»: назначено занятие № ${number} на ${at.toISOString()}`);
    return lesson;
  }

  /** Перенос запланированного занятия: дата, длительность, преподаватель, тема. Проведённое не переносится. */
  async move(coopname: string, input: EduMoveLessonInput): Promise<EdubridgeLessonRecord> {
    const lesson = await this.planned(coopname, input.lesson_id);
    const group = await this.group(coopname, lesson.group_id as string);
    if (input.held_at) lesson.held_at = momentOf(input.held_at);
    if (input.minutes !== undefined && input.minutes !== null) {
      const minutes = minutesOf(input.minutes, group.lesson_minutes);
      const all = (await this.lessons.findByGroup(coopname, group.id)).filter((l) => l.id !== lesson.id);
      if (this.budget(group, all) < minutes) throw DomainError.badRequest('EDUBRIDGE_PROGRAM_FULL', { minutesTotal: group.minutes_total });
      lesson.duration_minutes = minutes;
    }
    if (input.assignment_id !== undefined) {
      const assignment = input.assignment_id ? await this.courseAssignment(coopname, group.course_id, input.assignment_id) : null;
      lesson.assignment_id = assignment?.id ?? null;
      lesson.teacher_username = assignment?.teacher_username ?? null;
    }
    if (input.topic !== undefined && input.topic !== null) lesson.topic = input.topic.trim();
    // Перенесённое занятие больше не привязано к окну: перестройка расписания его не трогает.
    lesson.origin = EduLessonOrigin.EXTRA;
    return this.lessons.save(lesson);
  }

  /** Отмена запланированного занятия: номер и место в программе свободны. */
  async cancel(coopname: string, lessonId: string): Promise<EdubridgeLessonRecord> {
    const lesson = await this.planned(coopname, lessonId);
    lesson.status = EduLessonStatus.CANCELLED;
    return this.lessons.save(lesson);
  }

  /** Календарь: занятия по курсу, группе, преподавателю и окну дат. */
  async calendar(coopname: string, filter: EduCalendarFilter): Promise<EdubridgeLessonRecord[]> {
    const from = filter.from ? new Date(filter.from) : new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const to = filter.to ? new Date(filter.to) : new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    const rows = await this.lessons.findInRange(coopname, from, to);
    return rows.filter(
      (l) =>
        (!filter.course_id || l.course_id === filter.course_id) &&
        (!filter.group_id || l.group_id === filter.group_id) &&
        (!filter.teacher_username || l.teacher_username === filter.teacher_username)
    );
  }

  /** Занятия группы по порядку дат. */
  async ofGroup(coopname: string, groupId: string): Promise<EdubridgeLessonRecord[]> {
    return (await this.lessons.findByGroup(coopname, groupId)).sort(byDate);
  }

  /** Сколько минут программы ещё свободно с учётом живых занятий группы. */
  private budget(group: EdubridgeGroupRecord, lessons: EdubridgeLessonRecord[]): number {
    const used = lessons.filter((l) => l.status !== EduLessonStatus.CANCELLED).reduce((sum, l) => sum + Number(l.duration_minutes || 0), 0);
    const total = group.minutes_total > 0 ? group.minutes_total : group.minutes_per_month * OPEN_PROGRAM_MONTHS + used;
    return Math.max(0, total - used);
  }

  /** Освободить минуты под занятие: последние запланированные по расписанию стираются. */
  private async makeRoom(group: EdubridgeGroupRecord, all: EdubridgeLessonRecord[], minutes: number): Promise<void> {
    let budget = this.budget(group, all);
    if (budget >= minutes) return;
    const movable = all
      .filter((l) => l.status === EduLessonStatus.PLANNED && l.origin === EduLessonOrigin.SCHEDULE)
      .sort((a, b) => new Date(b.held_at).getTime() - new Date(a.held_at).getTime());
    const removed: EdubridgeLessonRecord[] = [];
    for (const lesson of movable) {
      if (budget >= minutes) break;
      removed.push(lesson);
      budget += Number(lesson.duration_minutes || 0);
    }
    if (budget < minutes) throw DomainError.badRequest('EDUBRIDGE_PROGRAM_FULL', { minutesTotal: group.minutes_total });
    await this.lessons.deleteMany(removed.map((l) => l.id));
    for (const r of removed) all.splice(all.indexOf(r), 1);
    this.logger.info(`[EDU.CAL] группа «${group.title}»: ради дополнительного занятия снято занятий по расписанию ${removed.length}`);
  }

  private async group(coopname: string, groupId: string): Promise<EdubridgeGroupRecord> {
    const group = await this.groups.findById(coopname, groupId);
    if (!group) throw DomainError.notFound('EDUBRIDGE_GROUP_NOT_FOUND');
    return group;
  }

  private async planned(coopname: string, lessonId: string): Promise<EdubridgeLessonRecord> {
    const lesson = await this.lessons.findById(coopname, lessonId);
    if (!lesson || !lesson.group_id) throw DomainError.notFound('EDUBRIDGE_LESSON_NOT_FOUND');
    if (lesson.status !== EduLessonStatus.PLANNED) throw DomainError.badRequest('EDUBRIDGE_LESSON_NOT_PLANNED', { lessonNumber: lesson.lesson_number });
    return lesson;
  }

  /** Действующий допуск преподавателя к курсу группы. */
  private async courseAssignment(coopname: string, courseId: string, assignmentId: string): Promise<EdubridgeTeacherAssignmentRecord> {
    const assignment = await this.teachers.findAssignment(coopname, assignmentId);
    if (!assignment || assignment.course_id !== courseId || assignment.status !== EduAssignmentStatus.ACTIVE) {
      throw DomainError.badRequest('EDUBRIDGE_SCHEDULE_TEACHER_NOT_ASSIGNED');
    }
    return assignment;
  }

  private async cached(cache: Map<string, EdubridgeTeacherAssignmentRecord | null>, coopname: string, id: string): Promise<EdubridgeTeacherAssignmentRecord | null> {
    if (!cache.has(id)) cache.set(id, await this.teachers.findAssignment(coopname, id));
    return cache.get(id) ?? null;
  }
}

/** Наименьший свободный номер занятия в группе. */
function nextFree(taken: Set<number>): number {
  let n = 1;
  while (taken.has(n)) n += 1;
  return n;
}

/**
 * Стенд со сжатым временем: дни недели там не работают, занятия раскладываются
 * равными шагами по сжатому месяцу — столько в месяц, сколько по условиям группы.
 */
function compressedOccurrences(group: EdubridgeGroupRecord, start: Date, limit: number): SlotOccurrence[] {
  const perMonth = Math.max(1, group.lessons_per_month);
  const step = Math.max(1000, Math.floor((eduMonthSeconds() * 1000) / perMonth));
  const slots = group.schedule_slots;
  const out: SlotOccurrence[] = [];
  for (let i = 0; i < limit; i += 1) {
    const slot = slots[i % slots.length];
    out.push({ at: new Date(start.getTime() + i * step), slot });
  }
  return out;
}

function momentOf(value: string): Date {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) throw DomainError.badRequest('EDUBRIDGE_LESSON_DATE_INVALID');
  return at;
}

function minutesOf(value: number | null | undefined, fallback: number): number {
  const minutes = value === undefined || value === null ? fallback : Number(value);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 24 * 60) throw DomainError.badRequest('EDUBRIDGE_SCHEDULE_MINUTES_INVALID');
  return minutes;
}

function reportDaysOf(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 365) throw DomainError.badRequest('EDUBRIDGE_REPORT_DAYS_INVALID');
  return value;
}

const byDate = (a: EdubridgeLessonRecord, b: EdubridgeLessonRecord) => new Date(a.held_at).getTime() - new Date(b.held_at).getTime();

