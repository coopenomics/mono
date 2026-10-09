import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EduEnrollmentStatus, EduGroupStatus } from '../../domain/enums';
import type { EdubridgeCourseRecord, EdubridgeGroupRecord } from '../../infrastructure/entities';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeGroupKyselyRepository } from '../../infrastructure/repositories/edubridge-group.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { courseMonths } from '../../domain/economy/course-fee.calculator';
import { addMonths } from '../../domain/economy/course-period.calculator';
import { EdubridgeChainTermsService } from './edubridge-chain-terms.service';
import { t } from '../../i18n';

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

  async list(coopname: string, courseId: string): Promise<EdubridgeGroupRecord[]> {
    return this.closeStarted(await this.groups.findByCourse(coopname, courseId));
  }

  async get(coopname: string, id: string): Promise<EdubridgeGroupRecord> {
    const group = await this.groups.findById(coopname, id);
    if (!group) throw DomainError.notFound('EDUBRIDGE_GROUP_NOT_FOUND');
    await this.closeStarted([group]);
    return group;
  }

  /**
   * Состояние группы по её датам. С дня начала занятий набор закрывается сам —
   * один раз: дальше его ведёт администратор и, открыв набор снова, принимает
   * участника в идущую группу. Когда срок программы вышел и действующих
   * подписок нет, группа завершена.
   */
  private async closeStarted(groups: EdubridgeGroupRecord[]): Promise<EdubridgeGroupRecord[]> {
    const changed = await this.settle(groups);
    for (const courseId of changed) await this.syncCourseStart(groups[0].coopname, courseId);
    return groups;
  }

  /** Сверка состояния групп с их датами; возвращает курсы, у групп которых что-то изменилось. */
  private async settle(groups: EdubridgeGroupRecord[]): Promise<Set<string>> {
    const changed = new Set<string>();
    for (const group of groups) {
      if (group.status !== EduGroupStatus.ACTIVE) continue;
      if (await this.finishEnded(group)) {
        changed.add(group.course_id);
        continue;
      }
      if (group.enrollment_closed_on_start || !hasStarted(group.starts_at)) continue;
      group.enrollment_open = false;
      group.enrollment_closed_on_start = true;
      await this.groups.save(group);
      changed.add(group.course_id);
      this.logger.info(`Набор в группу «${group.title}» закрыт: занятия начались`);
    }
    return changed;
  }

  /** Срок программы группы вышел, действующих подписок нет — группа завершена; возвращает, завершена ли. */
  private async finishEnded(group: EdubridgeGroupRecord): Promise<boolean> {
    if (!hasEnded(group) || (await this.hasLiveSubscriptions(group.coopname, group.id))) return false;
    group.status = EduGroupStatus.CLOSED;
    group.enrollment_open = false;
    await this.groups.save(group);
    this.logger.info(`Группа «${group.title}» завершена: срок программы вышел`);
    return true;
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
    const open = (await this.list(coopname, course.id)).filter((g) => g.status === EduGroupStatus.ACTIVE && g.enrollment_open);
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
      title: input.title?.trim() || t('edubridge.group.defaultTitle', { number: existing.length + 1 }),
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
    // Группа с наступившим днём начала открывается уже с закрытым набором.
    await this.closeStarted([group]);
    await this.syncCourseStart(coopname, course.id);
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
    if (input.starts_at !== undefined && sameDay(input.starts_at, group.starts_at) === false) await this.moveStart(course, group, input.starts_at);
    if (typeof input.enrollment_open === 'boolean') {
      group.enrollment_open = input.enrollment_open;
      // Набор в начавшейся группе задан администратором — сам он больше не закрывается.
      if (hasStarted(group.starts_at)) group.enrollment_closed_on_start = true;
    }
    const saved = await this.groups.save(group);
    await this.syncCourseStart(coopname, group.course_id);
    return saved;
  }

  /**
   * Дата начала занятий у курса — производная от его групп: ближайшая группа
   * с открытым набором, а когда набора нет — самая поздняя дата идущих групп. Её
   * показывают каталог и страница курса, чтобы ученик видел день, с которого
   * может начать.
   */
  private async syncCourseStart(coopname: string, courseId: string): Promise<void> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) return;
    const groups = await this.groups.findByCourse(coopname, courseId);
    await this.settle(groups);
    const next = nearestStart(groups);
    if (sameDay(next, course.starts_at)) return;
    course.starts_at = next;
    await this.courses.save(course);
  }

  /** Новая дата начала занятий: до первого занятия; от неё идут гарантийный срок и занятия в цепи. */
  private async moveStart(course: EdubridgeCourseRecord, group: EdubridgeGroupRecord, startsAt: string | null): Promise<void> {
    if ((await this.lessons.findByGroup(group.coopname, group.id)).length) throw DomainError.badRequest('EDUBRIDGE_COURSE_START_LOCKED_BY_LESSONS');
    group.starts_at = startsAt || null;
    reopenBeforeStart(group);
    await this.chainTerms.pushCourse(this.viewOf(course, group));
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
      if (groups.length === 1) {
        group.starts_at = course.starts_at;
        // Группа на площадке задаётся в панели группы: привязка курса меняет её, только когда сменился сам курс площадки.
        if (platformCourseOf(group.external_ref) !== platformCourseOf(course.external_ref)) group.external_ref = course.external_ref;
        reopenBeforeStart(group);
      }
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

/** Срок программы группы вышел: от дня начала прошли все её месяцы. Группа без конечной программы не заканчивается. */
function hasEnded(group: EdubridgeGroupRecord, now: Date = new Date()): boolean {
  const months = courseMonths(group.lessons_per_month, group.lessons_total);
  if (!group.starts_at || !months) return false;
  return addMonths(new Date(group.starts_at), months).getTime() <= now.getTime();
}

/** День начала занятий наступил; группа без даты начала не начиналась. */
function hasStarted(startsAt: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(startsAt) && new Date(startsAt as string).getTime() <= now.getTime();
}

/**
 * Начало занятий перенесено на будущий день: набор, закрытый по началу, снова
 * открыт и закроется сам в новый день начала.
 */
function reopenBeforeStart(group: EdubridgeGroupRecord): void {
  if (!group.enrollment_closed_on_start || hasStarted(group.starts_at)) return;
  group.enrollment_closed_on_start = false;
  group.enrollment_open = true;
}

/** Курс площадки из привязки вида «курс:группа». */
function platformCourseOf(externalRef: string | null | undefined): string {
  return String(externalRef ?? '').split(':')[0];
}

/** Дата начала для показа у курса: ближайшая группа с открытым набором, иначе самая поздняя дата идущих групп. */
function nearestStart(groups: EdubridgeGroupRecord[]): string | null {
  const dated = groups.filter((g) => g.status === EduGroupStatus.ACTIVE && g.starts_at).map((g) => ({ open: g.enrollment_open, at: String(g.starts_at) }));
  const day = (v: string) => new Date(v).getTime();
  const open = dated.filter((g) => g.open).sort((a, b) => day(a.at) - day(b.at));
  if (open.length) return open[0].at;
  const rest = dated.sort((a, b) => day(b.at) - day(a.at));
  return rest[0]?.at ?? null;
}

/** Одна ли это дата; `null` и пустая строка — «не назначена». */
function sameDay(a: string | null | undefined, b: string | null | undefined): boolean {
  const day = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '');
  return day(a) === day(b);
}
