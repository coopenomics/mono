import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EduEnrollmentStatus, EduGroupStatus } from '../../domain/enums';
import type { EdubridgeCourseRecord, EdubridgeGroupRecord } from '../../infrastructure/entities';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeGroupKyselyRepository } from '../../infrastructure/repositories/edubridge-group.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { EdubridgeChainTermsService } from './edubridge-chain-terms.service';

/** Условия, которые группа берёт у курса в день открытия и дальше держит сама. */
const TERM_FIELDS = [
  'lessons_per_month',
  'lessons_total',
  'lesson_minutes',
  'planned_hourly_rate',
  'pay_per_learner',
  'guarantee_days',
  'course_payment_enabled',
  'course_discount_bp',
  'fee_month',
] as const;

export interface EduGroupInput {
  course_id: string;
  title?: string | null;
  starts_at?: string | null;
  external_ref?: string | null;
}

export interface EduGroupUpdate {
  id: string;
  title?: string | null;
  starts_at?: string | null;
  external_ref?: string | null;
  enrollment_open?: boolean | null;
}

/**
 * Группы (наборы) курса. Группа — единица расчёта: участники записываются в
 * неё, и взносы, занятия, резерв преподавателям и возвраты считаются внутри
 * группы. Курс — программа с условиями по умолчанию; группа берёт их снимком
 * в день открытия. Две группы одного курса идут одновременно и не пересекаются.
 */
@Injectable()
export class EdubridgeGroupService {
  constructor(
    private readonly groups: EdubridgeGroupKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly lessons: EdubridgeLessonKyselyRepository,
    private readonly chainTerms: EdubridgeChainTermsService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeGroupService.name);
  }

  list(coopname: string, courseId: string): Promise<EdubridgeGroupRecord[]> {
    return this.groups.findByCourse(coopname, courseId);
  }

  async get(coopname: string, id: string): Promise<EdubridgeGroupRecord> {
    const group = await this.groups.findById(coopname, id);
    if (!group) throw DomainError.notFound('EDUBRIDGE_GROUP_NOT_FOUND');
    return group;
  }

  /**
   * Курс глазами группы: программа и описание — курса, условия, дата начала,
   * номер для цепи, привязка к площадке и учёт средств — группы. В таком виде
   * курс читают все расчёты, поэтому деньги и занятия считаются внутри группы.
   */
  viewOf(course: EdubridgeCourseRecord, group: EdubridgeGroupRecord): EdubridgeCourseRecord {
    const terms = Object.fromEntries(TERM_FIELDS.map((f) => [f, group[f]]));
    return {
      ...course,
      ...terms,
      chain_ref: group.chain_ref,
      starts_at: group.starts_at,
      external_ref: group.external_ref || course.external_ref,
      teacher_reserve_balance: group.teacher_reserve_balance,
      teacher_settled_total: group.teacher_settled_total,
    } as EdubridgeCourseRecord;
  }

  /** Курс глазами группы — по её идентификатору; `null`, когда курса либо группы нет. */
  async courseOf(coopname: string, courseId: string, groupId: string | null | undefined): Promise<EdubridgeCourseRecord | null> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) return null;
    const group = groupId ? await this.groups.findById(coopname, groupId) : await this.firstOf(coopname, course);
    return group ? this.viewOf(course, group) : course;
  }

  /** Первая группа курса; у курса без групп она заводится. */
  async firstOf(coopname: string, course: EdubridgeCourseRecord): Promise<EdubridgeGroupRecord> {
    const [first] = await this.groups.findByCourse(coopname, course.id);
    return first ?? this.create(coopname, { course_id: course.id });
  }

  /**
   * Группа, в которую сейчас записывается участник. Названа явно — она и
   * берётся, если набор в неё открыт. Не названа — единственная группа курса с
   * открытым набором; при нескольких участник выбирает сам.
   */
  async openFor(coopname: string, course: EdubridgeCourseRecord, groupId?: string | null): Promise<EdubridgeGroupRecord> {
    if (groupId) {
      const group = await this.get(coopname, groupId);
      if (group.course_id !== course.id) throw DomainError.notFound('EDUBRIDGE_GROUP_NOT_FOUND');
      if (group.status !== EduGroupStatus.ACTIVE || !group.enrollment_open) throw DomainError.badRequest('EDUBRIDGE_GROUP_ENROLLMENT_CLOSED');
      return group;
    }
    const open = await this.groups.findOpenByCourse(coopname, course.id);
    if (!open.length) {
      // Курс без групп — первая заводится сама: курс и есть его первая группа.
      if (!(await this.groups.findByCourse(coopname, course.id)).length) return this.create(coopname, { course_id: course.id });
      throw DomainError.badRequest('EDUBRIDGE_GROUP_ENROLLMENT_CLOSED');
    }
    if (open.length > 1) throw DomainError.badRequest('EDUBRIDGE_GROUP_CHOICE_REQUIRED');
    return open[0];
  }

  /**
   * Новая группа курса. Условия берутся снимком с курса на этот день и уходят
   * в цепь под номером группы: по ним контракт считает взносы, занятия и
   * возвраты этой группы.
   */
  async create(coopname: string, input: EduGroupInput): Promise<EdubridgeGroupRecord> {
    const course = await this.courses.findById(coopname, input.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    const existing = await this.groups.findByCourse(coopname, course.id);
    const entity = this.groups.create({
      coopname,
      course_id: course.id,
      title: input.title?.trim() || `Группа ${existing.length + 1}`,
      status: EduGroupStatus.ACTIVE,
      enrollment_open: true,
      external_ref: (input.external_ref ?? course.external_ref ?? '').trim(),
      // Первая группа наследует дату начала курса; у следующих её называет администратор.
      starts_at: input.starts_at ?? (existing.length ? null : course.starts_at),
      ...termsOf(course),
    });
    const stored = await this.groups.save(entity);
    // Запись перечитывается: номер группы для цепи выдаёт база при вставке.
    const group = (await this.groups.findById(coopname, stored.id)) ?? stored;
    await this.chainTerms.pushCourse(this.viewOf(course, group));
    this.logger.info(`Группа «${group.title}» курса «${course.title}» открыта, номер в цепи ${group.chain_ref}`);
    return group;
  }

  /**
   * Правка группы: название, привязка к площадке, набор и дата начала.
   * Денежные условия группы не меняются — участники вносят взнос по ним.
   * Дата начала не меняется после первого занятия.
   */
  async update(coopname: string, input: EduGroupUpdate): Promise<EdubridgeGroupRecord> {
    const group = await this.get(coopname, input.id);
    const course = await this.courses.findById(coopname, group.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    if (input.title?.trim()) group.title = input.title.trim();
    if (input.external_ref !== undefined && input.external_ref !== null) group.external_ref = input.external_ref.trim();
    if (typeof input.enrollment_open === 'boolean') group.enrollment_open = input.enrollment_open;
    if (input.starts_at !== undefined && sameDay(input.starts_at, group.starts_at) === false) {
      if ((await this.lessons.findByGroup(coopname, group.id)).length) throw DomainError.badRequest('EDUBRIDGE_COURSE_START_LOCKED_BY_LESSONS');
      group.starts_at = input.starts_at || null;
      // Дата начала — условие расчёта: от неё идут гарантийный срок и занятия в цепи.
      await this.chainTerms.pushCourse(this.viewOf(course, group));
    }
    return this.groups.save(group);
  }

  /** Группа завершена: набор закрыт, новых занятий и подписок по ней нет. Действующие подписки её держат. */
  async close(coopname: string, id: string): Promise<EdubridgeGroupRecord> {
    const group = await this.get(coopname, id);
    if (await this.hasLiveSubscriptions(coopname, group.id)) throw DomainError.badRequest('EDUBRIDGE_GROUP_HAS_SUBSCRIPTIONS');
    group.status = EduGroupStatus.CLOSED;
    group.enrollment_open = false;
    return this.groups.save(group);
  }

  /**
   * Условия курса изменены: группы, по которым ещё никто не вносил взнос и не
   * проводил занятий, берут новые условия; у остальных они прежние. Отказ
   * цепи по одной группе остальные не держит.
   */
  async applyCourseTerms(coopname: string, course: EdubridgeCourseRecord): Promise<void> {
    const groups = await this.groups.findByCourse(coopname, course.id);
    if (!groups.length) {
      await this.create(coopname, { course_id: course.id });
      return;
    }
    for (const group of groups) {
      if (group.status !== EduGroupStatus.ACTIVE || (await this.isTouched(coopname, group.id))) continue;
      Object.assign(group, termsOf(course));
      // Единственная группа курса идёт с его датой начала и привязкой к площадке.
      if (groups.length === 1) Object.assign(group, { starts_at: course.starts_at, external_ref: course.external_ref });
      try {
        await this.chainTerms.pushCourse(this.viewOf(course, group));
        await this.groups.save(group);
      } catch (e) {
        this.logger.warn(`Условия группы «${group.title}» курса «${course.title}» не обновлены: ${(e as Error)?.message ?? e}`);
      }
    }
  }

  /** Условия всех групп — в цепь: при запуске, для групп, заведённых до расчётов на контракте. */
  async pushAll(coopname: string): Promise<void> {
    for (const course of await this.courses.listAll(coopname)) {
      for (const group of await this.groups.findByCourse(coopname, course.id)) {
        await this.chainTerms.tryPushCourse(this.viewOf(course, group));
      }
    }
  }

  /** Учёт средств группы — копия учёта в цепи; возвращает, изменилось ли что-то. */
  async saveFunds(group: EdubridgeGroupRecord, reserve: string, settled: string): Promise<boolean> {
    if (group.teacher_reserve_balance === reserve && group.teacher_settled_total === settled) return false;
    group.teacher_reserve_balance = reserve;
    group.teacher_settled_total = settled;
    await this.groups.save(group);
    return true;
  }

  /** Есть ли по группе действующие подписки. */
  async hasLiveSubscriptions(coopname: string, groupId: string): Promise<boolean> {
    const rows = await this.enrollments.findByGroup(coopname, groupId);
    return rows.some((e) => e.status === EduEnrollmentStatus.ACTIVE || e.status === EduEnrollmentStatus.PENDING);
  }

  /** По группе уже вносили взнос либо проводили занятие — её условия закреплены. */
  private async isTouched(coopname: string, groupId: string): Promise<boolean> {
    if ((await this.enrollments.findByGroup(coopname, groupId)).length) return true;
    return (await this.lessons.findByGroup(coopname, groupId)).length > 0;
  }
}

function termsOf(course: EdubridgeCourseRecord): Partial<EdubridgeGroupRecord> {
  return Object.fromEntries(TERM_FIELDS.map((f) => [f, course[f]])) as Partial<EdubridgeGroupRecord>;
}

/** Одна ли это дата; `null` и пустая строка — «не назначена». */
function sameDay(a: string | null | undefined, b: string | null | undefined): boolean {
  const day = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '');
  return day(a) === day(b);
}
