import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EduAccessCarrier, EduEnrollmentStatus, EduGroupStatus } from '../../domain/enums';
import type { EdubridgeCourseRecord, EdubridgeEnrollmentRecord, EdubridgeGroupRecord } from '../../infrastructure/entities';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeGroupKyselyRepository } from '../../infrastructure/repositories/edubridge-group.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { addMonths } from '../../domain/economy/course-period.calculator';
import { isTimeCompressed } from '../../domain/economy/time-scale';
import { isResumable } from '../../domain/lib/resumable';
import { EdubridgeChainTermsService } from './edubridge-chain-terms.service';
import { EdubridgeCalendarService } from './edubridge-calendar.service';
import { hasStarted, startMomentOf } from '../../domain/lib/group-start';
import { EduLessonStatus } from '../../domain/enums';

export { startMomentOf };
import { t } from '../../i18n';

/** Условия, которые группа берёт у курса в день открытия и дальше держит сама. */
const TERM_FIELDS = [
  'lessons_per_month',
  'lessons_total',
  'lesson_minutes',
  'program_months',
  'minutes_per_month',
  'minutes_total',
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
  /** Начало занятий через столько минут — только на стенде со сжатым временем. */
  starts_in_minutes?: number | null;
  external_ref?: string | null;
}

export interface EduGroupUpdate {
  id: string;
  title?: string | null;
  starts_at?: string | null;
  /** Начало занятий через столько минут — только на стенде со сжатым временем. */
  starts_in_minutes?: number | null;
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
    private readonly calendar: EdubridgeCalendarService,
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
      if (group.enrollment_closed_on_start || !hasStarted(startMomentOf(group))) continue;
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
    if (!hasEnded(group)) return false;
    const rows = await this.enrollments.findByGroup(group.coopname, group.id);
    // Действующие подписки либо открытые расчёты: преподаватель ещё отчитывается о занятиях — группа идёт.
    if (rows.some((e) => isLive(e) || isResumable(e))) return false;
    await this.markFinished(group);
    this.logger.info(`Группа «${group.title}» завершена: срок программы вышел, расчёты закрыты`);
    return true;
  }

  /**
   * Администратор завершает группу: её программа закончена, отчётов по занятиям
   * больше не будет. Расчёты по истёкшим подпискам к этому моменту закрывает
   * вызывающий; с действующими подписками группа не завершается.
   */
  async finish(coopname: string, groupId: string): Promise<EdubridgeGroupRecord> {
    const group = await this.get(coopname, groupId);
    if (group.status !== EduGroupStatus.ACTIVE) throw DomainError.badRequest('EDUBRIDGE_GROUP_NOT_ACTIVE');
    if (await this.hasLiveSubscriptions(coopname, groupId)) throw DomainError.badRequest('EDUBRIDGE_GROUP_FINISH_LIVE_SUBSCRIPTIONS');
    await this.markFinished(group);
    this.logger.info(`Группа «${group.title}» завершена администратором`);
    await this.syncCourseStart(coopname, group.course_id);
    return group;
  }

  private async markFinished(group: EdubridgeGroupRecord): Promise<void> {
    group.status = EduGroupStatus.CLOSED;
    group.enrollment_open = false;
    await this.groups.save(group);
    // Занятия, о которых преподаватель не отчитался, не состоятся: отчёта по завершённой группе цепь не примет.
    await this.calendar.cancelPlanned(group.coopname, group);
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
      // Начало занятий глазами расчётов — момент: на стенде со сжатым временем он с точностью до минуты.
      starts_at: startMomentOf(group),
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
    const entity = this.groups.create(newGroupFields(coopname, course, input, existing.length));
    if (input.starts_in_minutes !== undefined && input.starts_in_minutes !== null) setStartIn(entity, input.starts_in_minutes);
    const stored = await this.groups.save(entity);
    // Запись перечитывается: номер группы для цепи выдаёт база при вставке.
    const group = (await this.groups.findById(coopname, stored.id)) ?? stored;
    // Группа с наступившим днём начала открывается уже с закрытым набором.
    await this.closeStarted([group]);
    await this.syncCourseStart(coopname, course.id);
    await this.chainTerms.pushCourse(this.viewOf(course, group));
    // Окна новой группы сразу получают преподавателей курса: занятия календаря строятся уже с ними.
    await this.calendar.syncTeachers(coopname, group);
    await this.calendar.rebuild(coopname, group);
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
    const startBefore = startMomentOf(group);
    await this.applyStart(course, group, input);
    const startMoved = startMomentOf(group) !== startBefore;
    if (typeof input.enrollment_open === 'boolean') {
      group.enrollment_open = input.enrollment_open;
      // Набор в начавшейся группе задан администратором — сам он больше не закрывается.
      if (hasStarted(startMomentOf(group))) group.enrollment_closed_on_start = true;
    }
    const saved = await this.groups.save(group);
    await this.syncCourseStart(coopname, group.course_id);
    if (startMoved) await this.calendar.rebuild(coopname, saved);
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

  /** Начало занятий из правки группы: минуты (стенд со сжатым временем) либо другая дата. */
  private async applyStart(course: EdubridgeCourseRecord, group: EdubridgeGroupRecord, input: EduGroupUpdate): Promise<void> {
    const minutes = input.starts_in_minutes;
    if (minutes !== undefined && minutes !== null) return this.moveStart(course, group, null, minutes);
    if (input.starts_at !== undefined && sameDay(input.starts_at, group.starts_at) === false) await this.moveStart(course, group, input.starts_at);
  }

  /** Новая дата начала занятий: до первого проведённого занятия; от неё идут гарантийный срок, календарь и занятия в цепи. */
  private async moveStart(course: EdubridgeCourseRecord, group: EdubridgeGroupRecord, startsAt: string | null, inMinutes?: number): Promise<void> {
    if ((await this.lessons.findByGroup(group.coopname, group.id)).some(isHeld)) throw DomainError.badRequest('EDUBRIDGE_COURSE_START_LOCKED_BY_LESSONS');
    if (inMinutes === undefined) {
      group.starts_at = startsAt || null;
      group.starts_at_time = null;
    } else {
      setStartIn(group, inMinutes);
    }
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
      Object.assign(group, termsOf(course), { schedule_slots: course.schedule_slots ?? [], report_days: course.report_days ?? 7 });
      // Единственная группа курса идёт с его датой начала и привязкой к площадке.
      if (groups.length === 1) followCourse(group, course);
      try {
        await this.chainTerms.pushCourse(this.viewOf(course, group));
        await this.groups.save(group);
        // Окна пришли с курса без преподавателей — расставляем их по допускам заново.
        await this.calendar.syncTeachers(coopname, group);
        await this.calendar.rebuild(coopname, group);
      } catch (e) {
        this.logger.warn(`Условия группы «${group.title}» курса «${course.title}» не обновлены: ${(e as Error)?.message ?? e}`);
      }
    }
  }

  /**
   * Календари групп курса приводятся к допускам и состоянию групп. У идущей
   * группы преподаватели окон расставляются заново, календарь с изменёнными
   * окнами перестраивается. У завершённой и отменённой запланированные занятия
   * снимаются — так чинятся и группы, закрытые до этого правила. Отказ по одной
   * группе остальные не держит.
   */
  async syncCalendars(coopname: string, courseId: string): Promise<void> {
    for (const group of await this.groups.findByCourse(coopname, courseId)) {
      try {
        if (group.status !== EduGroupStatus.ACTIVE) await this.calendar.cancelPlanned(coopname, group);
        else if (await this.calendar.syncTeachers(coopname, group)) await this.calendar.rebuild(coopname, group);
      } catch (e) {
        this.logger.warn(`Календарь группы «${group.title}» не приведён в порядок: ${(e as Error)?.message ?? e}`);
      }
    }
  }

  /**
   * Подписку можно продлить: группа идёт, программа длиннее одного месяца и
   * продолжается после оплаченного срока. Программа в один месяц оплачивается
   * одним взносом и заканчивается сама: следующий раз — запись в новую группу.
   * Программа без конечного числа занятий продлевается всегда.
   */
  async isRenewable(enrollment: Pick<EdubridgeEnrollmentRecord, 'coopname' | 'group_id' | 'paid_until'>): Promise<boolean> {
    if (!enrollment.group_id) return true;
    const group = await this.groups.findById(enrollment.coopname, enrollment.group_id);
    if (!group) return true;
    if (group.status !== EduGroupStatus.ACTIVE) return false;
    // Программа не длиннее месяца оплачивается одним взносом.
    if (Number(group.program_months) > 0 && Number(group.program_months) <= 1) return false;
    const end = programEndsAt(group);
    if (!end || !enrollment.paid_until) return true;
    return new Date(enrollment.paid_until).getTime() < end.getTime();
  }

  /** Группа отменена по недобору: набор закрыт, записаться в неё нельзя, другие группы курса идут дальше. */
  async cancel(coopname: string, group: EdubridgeGroupRecord): Promise<EdubridgeGroupRecord> {
    group.status = EduGroupStatus.CANCELLED;
    group.enrollment_open = false;
    const saved = await this.groups.save(group);
    // Набор не состоялся — занятий группы не будет, отчётов по ним от преподавателя не ждём.
    await this.calendar.cancelPlanned(coopname, saved);
    await this.syncCourseStart(coopname, group.course_id);
    return saved;
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
    return rows.some(isLive);
  }

  /** По группе уже вносили взнос либо проводили занятие — её условия закреплены. */
  private async isTouched(coopname: string, groupId: string): Promise<boolean> {
    if ((await this.enrollments.findByGroup(coopname, groupId)).length) return true;
    return (await this.lessons.findByGroup(coopname, groupId)).some(isHeld);
  }
}

/** Занятие проведено: отчёт подан, расчёт прошёл. */
const isHeld = (l: { status: EduLessonStatus }) => l.status === EduLessonStatus.HELD;

function termsOf(course: EdubridgeCourseRecord): Partial<EdubridgeGroupRecord> {
  return Object.fromEntries(TERM_FIELDS.map((f) => [f, course[f]])) as Partial<EdubridgeGroupRecord>;
}

/** Конец программы группы: начало занятий плюс все её месяцы; `null` — программа без конца либо начало не назначено. */
export function programEndsAt(group: Pick<EdubridgeGroupRecord, 'starts_at' | 'starts_at_time' | 'program_months'>): Date | null {
  const months = Math.max(0, Number(group.program_months || 0));
  const start = startMomentOf(group);
  return start && months ? addMonths(new Date(start), months) : null;
}

/** Срок программы группы вышел: от дня начала прошли все её месяцы. Группа без конечной программы не заканчивается. */
function hasEnded(group: EdubridgeGroupRecord, now: Date = new Date()): boolean {
  const end = programEndsAt(group);
  return Boolean(end) && (end as Date).getTime() <= now.getTime();
}

/** Действующая подписка: оплачена либо ожидает подключения. */
function isLive(e: Pick<EdubridgeEnrollmentRecord, 'status'>): boolean {
  return e.status === EduEnrollmentStatus.ACTIVE || e.status === EduEnrollmentStatus.PENDING;
}


/**
 * «Начало через N минут» — только на стенде со сжатым временем: в работе
 * начало занятий называется датой.
 */
function setStartIn(group: Partial<EdubridgeGroupRecord>, minutes: number): void {
  if (!isTimeCompressed()) throw DomainError.badRequest('EDUBRIDGE_START_IN_MINUTES_STAND_ONLY');
  const moment = new Date(Date.now() + Math.max(0, minutes) * 60_000);
  group.starts_at = moment.toISOString().slice(0, 10);
  group.starts_at_time = moment;
}


/**
 * Начало занятий перенесено на будущий день: набор, закрытый по началу, снова
 * открыт и закроется сам в новый день начала.
 */
function reopenBeforeStart(group: EdubridgeGroupRecord): void {
  if (!group.enrollment_closed_on_start || hasStarted(startMomentOf(group))) return;
  group.enrollment_closed_on_start = false;
  group.enrollment_open = true;
}

/** Поля новой группы: снимок условий курса, первая группа наследует дату начала и привязку к площадке. */
function newGroupFields(coopname: string, course: EdubridgeCourseRecord, input: EduGroupInput, existingCount: number): Partial<EdubridgeGroupRecord> {
  return {
    coopname,
    course_id: course.id,
    title: input.title?.trim() || t('edubridge.group.defaultTitle', { number: existingCount + 1 }),
    status: EduGroupStatus.ACTIVE,
    enrollment_open: true,
    external_ref: (input.external_ref ?? course.external_ref ?? '').trim(),
    // Первая группа наследует дату начала курса; у следующих её называет администратор.
    starts_at: input.starts_at ?? (existingCount ? null : course.starts_at),
    ...termsOf(course),
    // Окна расписания и срок на отчёт — образец курса; у группы они свои.
    schedule_slots: course.schedule_slots ?? [],
    report_days: course.report_days ?? 7,
  };
}

/** Единственная группа курса идёт с его датой начала и привязкой к площадке. */
function followCourse(group: EdubridgeGroupRecord, course: EdubridgeCourseRecord): void {
  // Дата курса меняет начало группы, только когда день другой: момент, названный на стенде, остаётся.
  if (sameDay(course.starts_at, group.starts_at) === false) Object.assign(group, { starts_at: course.starts_at, starts_at_time: null });
  // Группа на площадке задаётся в панели группы: привязка курса меняет её, только когда сменился сам курс площадки.
  if (platformCourseOf(group.external_ref, course.carrier) !== platformCourseOf(course.external_ref, course.carrier)) group.external_ref = course.external_ref;
  reopenBeforeStart(group);
}

/** Курс площадки из привязки вида «курс:группа». */
function platformCourseOf(externalRef: string | null | undefined, carrier?: EduAccessCarrier | string | null): string {
  const ref = String(externalRef ?? '');
  // «Курс:группа» — привязка Skillspace. У остальных площадок привязка цельная: название группы GetCourse может содержать двоеточие.
  return carrier === EduAccessCarrier.SKILLSPACE ? ref.split(':')[0] : ref;
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
