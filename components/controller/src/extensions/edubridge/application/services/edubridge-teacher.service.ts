import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { createHash, randomUUID } from 'crypto';
import { Cooperative } from 'cooptypes';
import { platformSettings, DomainError } from '@coopenomics/extension-kit';
import {
  COUNCIL_PORT,
  DECISION_TRACKING_PORT,
  DOCUMENT_PORT,
  DecisionEventType,
  DecisionTrackedEvent,
  FREE_DECISION_PORT,
  LOGGER_PORT,
  USER_AVATAR_PORT,
  USER_WALLET_PORT,
  type ICouncilPort,
  type IDecisionTrackingPort,
  type IDocumentPort,
  type IFreeDecisionPort,
  type ILoggerPort,
  type InnerDocumentAggregate,
  type InnerGeneratedDocument,
  type ISignedDocument,
  type IUserAvatarPort,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { EduAssignmentStatus, EduContractStatus, EduContributionStatus, EduCouncilOutcome, EduRidType } from '../../domain/enums';
import { guaranteeEndsAt } from '../../domain/economy/guarantee';
import { EdubridgeFundsService } from './edubridge-funds.service';
import { formatDate, formatDateTime, toChainTimePoint } from '../../domain/lib/lesson-dates';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type {
  EdubridgeContributionEntity,
  EdubridgeCourseEntity,
  EdubridgeLessonEntity,
  EdubridgeTeacherAssignmentEntity,
  EdubridgeTeacherContractEntity,
} from '../../infrastructure/entities';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeLessonRepository } from '../../infrastructure/repositories/edubridge-lesson.repository';
import { costOfHours } from '../../domain/economy/course-fee.calculator';
import { EdubridgeTeacherRepository } from '../../infrastructure/repositories/edubridge-teacher.repository';
import type {
  EduAssignmentInputDTO,
  EduLessonReportInputDTO,
  EduTeacherDTO,
  EduTeacherSettlementDTO,
} from '../dto/edu-teacher.dto';
import { EdubridgeNamesService } from '../membership/edubridge-names.service';
import {
  EDUBRIDGE_ANNEX_DECIDED_EVENT,
  EDUBRIDGE_CONTRACT_DECIDED_EVENT,
  EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT,
  EDUBRIDGE_CONTRIBUTION_SUBMITTED_EVENT,
} from '../events/edubridge.events';
import { t } from '../../i18n';

const SHARE_WALLET = 'w.wal.share';
/** Одно поле vars под все решения о РИД — ядро пишет туда номер и дату последнего решения. */
const RID_VARS_FIELD = 'education_rid_decision';
/** Договор в этих статусах не действует, и преподаватель подписывает его заново. */
const RESIGNABLE_CONTRACT = [EduContractStatus.DECLINED, EduContractStatus.TERMINATED];
/** Взносы, по которым расчёт с преподавателем ещё не закрыт. */
const OPEN_CONTRIBUTIONS = [
  EduContributionStatus.HELD,
  EduContributionStatus.SUBMITTED,
  EduContributionStatus.COUNCIL_APPROVED,
  EduContributionStatus.ACT_SIGNED,
];
const DAY_MS = 24 * 60 * 60 * 1000;
/** Допуск на расхождение часов клиента и сервера при проверке даты занятия. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
/** Во сколько раз занятие в отчёте может быть длиннее занятия по курсу (сдвоенный урок). */
const MAX_LESSON_STRETCH = 2;
/** Ответ цепи на повторную подачу заявления по тем же материалам. */
const ALREADY_SUBMITTED = /уже подано/i;

/**
 * Преподавательский контур: ДУХД → назначение с приложением → взнос РИД по
 * заявлению → решение совета (платформенный проект свободного решения) →
 * акт приёма-передачи → `acceptrid` (проводка Дт 04 / Кт 80, право требования
 * в главном паевом кошельке; возврат — штатным механизмом платформы).
 *
 * Договор УХД и приложения к нему — двухподписные, как в «Благоросте»:
 * преподаватель подписывает первым (`signcontract` / `signannex`), контракт
 * ставит документ в очередь одобрений совета, председатель подписывает вторым
 * со стола «Запросы одобрений», и коллбэк совета (`apprvcontr` / `apprvannex`)
 * делает договор действующим или назначение активным — статусы здесь
 * переводит слушатель этих действий, а не сама мутация.
 */
@Injectable()
export class EdubridgeTeacherService {
  constructor(
    private readonly teachers: EdubridgeTeacherRepository,
    private readonly courses: EdubridgeCourseRepository,
    private readonly lessons: EdubridgeLessonRepository,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(FREE_DECISION_PORT) private readonly freeDecisions: IFreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT) private readonly tracking: IDecisionTrackingPort,
    @Inject(COUNCIL_PORT) private readonly council: ICouncilPort,
    @Inject(USER_WALLET_PORT) private readonly wallets: IUserWalletPort,
    @Inject(USER_AVATAR_PORT) private readonly avatars: IUserAvatarPort,
    private readonly names: EdubridgeNamesService,
    private readonly funds: EdubridgeFundsService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly events: EventEmitter2
  ) {
    this.logger.setContext(EdubridgeTeacherService.name);
  }

  // ── Договор УХД ────────────────────────────────────────────────────────────
  contract(coopname: string, teacher: string) {
    return this.teachers.findContract(coopname, teacher);
  }

  /**
   * Первая подпись договора — преподавателя. В цепь уходит `signcontract`,
   * запись ждёт подписи председателя; действующим договор станет по
   * коллбэку совета (`onContractApproved`). Отклонённый договор подписывается
   * заново — старая запись перезаписывается.
   */
  async signContract(coopname: string, teacher: string, document: ISignedDocument, number: string, hourlyRate: string) {
    const existing = await this.teachers.findContract(coopname, teacher);
    if (existing && !RESIGNABLE_CONTRACT.includes(existing.status)) return existing;
    if (!document.signatures?.some((s) => s.signer === teacher)) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_NOT_SIGNED_BY_TEACHER');
    // Ставку преподаватель называет один раз при подключении. Дальше она
    // определяет и себестоимость курса, и его собственный взнос за занятие,
    // поэтому менять её в одиночку он не может — это делает администратор.
    // Прекращённый договор ставку не держит: новый договор — новые условия.
    if (existing && existing.status !== EduContractStatus.TERMINATED && isPositiveRate(existing.hourly_rate) && existing.hourly_rate !== hourlyRate) {
      throw DomainError.badRequest('EDUBRIDGE_TEACHER_RATE_ALREADY_SET');
    }

    await this.chain.signContract({ coopname, username: teacher, contract_hash: document.hash, contract: document as never });
    this.logger.info(`[EDU.TEACH] ${teacher}: договор УХД ${document.hash} подписан, ждёт подписи председателя`);

    return this.teachers.saveContract({
      ...(existing ?? {}),
      coopname,
      teacher_username: teacher,
      contract_hash: document.hash.toLowerCase(),
      contract_number: number,
      hourly_rate: hourlyRate,
      status: EduContractStatus.PENDING_APPROVAL,
      decline_reason: '',
      approved_at: null,
    });
  }

  /**
   * Состояние договора из цепи — по дельте `educontracts`, сразу как она
   * пришла, без трёхсекундной задержки событий действий. Так ответ на подпись
   * председателя (он ждёт эту дельту) уже видит действующий договор.
   * Уведомления и причина отказа остаются за действиями — их в дельте нет.
   */
  async applyContractFromChain(
    coopname: string,
    teacher: string,
    contractHash: string,
    chainStatus: string | null,
    approvedAt: string | null
  ): Promise<void> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c || c.contract_hash !== contractHash.toLowerCase()) return;
    if (chainStatus === 'active' && c.status === EduContractStatus.PENDING_APPROVAL) {
      c.status = EduContractStatus.ACTIVE;
      c.approved_at = approvedAt ? new Date(`${approvedAt.replace(/Z?$/, 'Z')}`) : new Date();
      c.decline_reason = '';
      await this.teachers.saveContract(c);
    } else if (chainStatus === null && c.status === EduContractStatus.PENDING_APPROVAL) {
      // Отказ председателя стирает запись; причину допишет действие dclinecontr.
      c.status = EduContractStatus.DECLINED;
      await this.teachers.saveContract(c);
    }
  }

  /** Коллбэк совета `apprvcontr`: председатель подписал — договор действует. */
  async onContractApproved(coopname: string, teacher: string, contractHash: string): Promise<void> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c || c.contract_hash !== contractHash.toLowerCase()) {
      this.logger.warn(`[EDU.TEACH] apprvcontr для неизвестного договора ${contractHash} (${teacher})`);
      return;
    }
    // Статус мог уже прийти дельтой — дату подписи из цепи не перетираем.
    c.status = EduContractStatus.ACTIVE;
    c.approved_at = c.approved_at ?? new Date();
    c.decline_reason = '';
    await this.teachers.saveContract(c);
    this.events.emit(EDUBRIDGE_CONTRACT_DECIDED_EVENT, { coopname, teacher_username: teacher, contract_hash: c.contract_hash, approved: true });
  }

  /** Коллбэк совета `dclinecontr`: председатель отказал — договор можно подписать заново. */
  async onContractDeclined(coopname: string, teacher: string, contractHash: string, reason: string): Promise<void> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c || c.contract_hash !== contractHash.toLowerCase()) return;
    c.status = EduContractStatus.DECLINED;
    c.decline_reason = reason;
    await this.teachers.saveContract(c);
    this.events.emit(EDUBRIDGE_CONTRACT_DECIDED_EVENT, { coopname, teacher_username: teacher, contract_hash: c.contract_hash, approved: false, reason });
  }

  /**
   * Прекращение договора: преподаватель вышел из кооператива либо стороны
   * договорились. Расчёт к этому моменту закрыт — незакрытые взносы и
   * действующие назначения держат и выход, и прекращение. Вернувшийся пайщик
   * подписывает договор заново.
   */
  async terminateContract(coopname: string, teacher: string, reason: string): Promise<EdubridgeTeacherContractEntity | null> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c || RESIGNABLE_CONTRACT.includes(c.status)) return c;
    if (!reason?.trim()) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_TERMINATION_REASON_REQUIRED');

    const openAssignments = (await this.teachers.listAssignments(coopname, { teacher })).filter(
      (a) => a.status === EduAssignmentStatus.ACTIVE || a.status === EduAssignmentStatus.PENDING_APPROVAL
    );
    if (openAssignments.length) throw DomainError.badRequest('EDUBRIDGE_TEACHER_HAS_OPEN_ASSIGNMENTS');
    const openContributions = await this.teachers.listContributions(coopname, { teacher, statuses: OPEN_CONTRIBUTIONS });
    if (openContributions.length) throw DomainError.badRequest('EDUBRIDGE_TEACHER_HAS_OPEN_CONTRIBUTIONS');

    // Ожидающий договор в цепи снимает только отказ председателя.
    if (c.status === EduContractStatus.PENDING_APPROVAL) {
      throw DomainError.badRequest('EDUBRIDGE_CONTRACT_PENDING_APPROVAL_TERMINATE');
    }
    await this.chain.terminateContract({ coopname, username: teacher, contract_hash: c.contract_hash, reason: reason.trim() });
    c.status = EduContractStatus.TERMINATED;
    c.decline_reason = reason.trim();
    const saved = await this.teachers.saveContract(c);
    this.logger.info(`[EDU.TEACH] ${teacher}: договор УХД ${c.contract_hash} прекращён — ${reason.trim()}`);
    return saved;
  }

  private async requireContract(coopname: string, teacher: string): Promise<EdubridgeTeacherContractEntity> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_REQUIRED');
    if (c.status === EduContractStatus.PENDING_APPROVAL) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_NOT_APPROVED');
    if (c.status === EduContractStatus.TERMINATED) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_TERMINATED');
    if (c.status !== EduContractStatus.ACTIVE) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_DECLINED');
    return c;
  }

  // ── Назначения ─────────────────────────────────────────────────────────────
  /**
   * Преподаватели кооператива — все, кто подписал договор участия в
   * хозяйственной деятельности, вместе с состоянием договора и числом
   * назначений. Имя и фотография берутся у ядра через порты: своей копии
   * персональных данных расширение не держит.
   */
  async listTeachers(coopname: string): Promise<EduTeacherDTO[]> {
    const contracts = await this.teachers.listContracts(coopname);
    const usernames = contracts.map((c) => c.teacher_username);
    const [names, avatars, assignments] = await Promise.all([
      this.names.displayNames(usernames),
      this.avatars.getAvatarUrls(usernames),
      this.teachers.listAssignments(coopname),
    ]);
    return contracts.map((c) => {
      const own = assignments.filter((a) => a.teacher_username === c.teacher_username);
      return {
        username: c.teacher_username,
        hourly_rate: c.hourly_rate,
        display_name: names.get(c.teacher_username) ?? '',
        avatar_url: avatars.get(c.teacher_username) ?? null,
        contract_number: c.contract_number,
        contract_status: c.status,
        signed_at: c.signed_at,
        approved_at: c.approved_at ?? null,
        assignments_total: own.length,
        assignments_active: own.filter((a) => a.status === EduAssignmentStatus.ACTIVE).length,
      };
    });
  }

  async listAssignments(coopname: string, teacher?: string) {
    const rows = await this.teachers.listAssignments(coopname, teacher ? { teacher } : {});
    return Promise.all(rows.map(async (a) => ({ assignment: a, course: await this.courses.findById(coopname, a.course_id) })));
  }

  async createAssignment(coopname: string, input: EduAssignmentInputDTO): Promise<EdubridgeTeacherAssignmentEntity> {
    const course = await this.courses.findById(coopname, input.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    if (input.period_to < input.period_from) throw DomainError.badRequest('EDUBRIDGE_ASSIGNMENT_PERIOD_INVALID');
    await this.assertRateCovered(coopname, input.teacher_username.trim(), course);
    const entity = this.teachers.createAssignment({
      coopname,
      teacher_username: input.teacher_username.trim(),
      course_id: input.course_id,
      schedule: input.schedule ?? '',
      expected_result: input.expected_result ?? '',
      period_from: input.period_from,
      period_to: input.period_to,
      // Нагрузка по умолчанию — всё расписание курса: один преподаватель ведёт его целиком.
      minutes_per_month: input.minutes_per_month ?? course.lessons_per_month * course.lesson_minutes,
      status: EduAssignmentStatus.DRAFT,
    });
    return this.teachers.saveAssignment(entity);
  }

  /**
   * Взнос учеников посчитан от плановой ставки курса, и в резерв выплат уходит
   * именно она. Преподаватель со ставкой выше плановой резервом не обеспечен:
   * сначала поднимается ставка курса — для новых подписок, а разница по
   * действующим покрывается свободными средствами программы осознанно.
   */
  private async assertRateCovered(coopname: string, teacher: string, course: EdubridgeCourseEntity): Promise<void> {
    const contract = await this.teachers.findContract(coopname, teacher);
    const error = rateCoverageError(contract?.hourly_rate, course.planned_hourly_rate);
    if (error) throw error;
  }

  /**
   * Черновики назначений по списку «Курс ведут». Преподаватель, добавленный в
   * курс, получает черновик назначения — приложение к договору, которое он
   * видит на своём столе и подписывает; убранный из курса — его неподписанный
   * черновик закрывается. Подписанные и действующие назначения не трогаются:
   * их закрывает администратор явно. Идемпотентно.
   */
  async syncCourseAssignments(coopname: string, course: EdubridgeCourseEntity): Promise<void> {
    const listed = new Set(course.teacher_usernames ?? []);
    const forCourse = (await this.teachers.listAssignments(coopname)).filter((a) => a.course_id === course.id);
    const period = coursePeriod(course);
    for (const teacher of listed) {
      if (forCourse.some((a) => a.teacher_username === teacher && a.status !== EduAssignmentStatus.CLOSED)) continue;
      await this.createAssignment(coopname, {
        teacher_username: teacher,
        course_id: course.id,
        schedule: course.schedule ?? '',
        expected_result: t('edubridge.teacher.assignmentExpectedResult', { courseTitle: course.title }),
        period_from: period.from,
        period_to: period.to,
      } as EduAssignmentInputDTO);
      this.logger.info(`Черновик назначения: ${teacher} → курс «${course.title}»`);
    }
    for (const a of forCourse) {
      const unsigned = a.status === EduAssignmentStatus.DRAFT || a.status === EduAssignmentStatus.DECLINED;
      if (!listed.has(a.teacher_username) && unsigned) {
        a.status = EduAssignmentStatus.CLOSED;
        await this.teachers.saveAssignment(a);
      }
    }
  }

  /** Черновики по всем курсам — при запуске: курсы, заполненные до появления связи. */
  async syncAllCourseAssignments(coopname: string): Promise<void> {
    for (const course of await this.courses.listAll(coopname)) {
      try {
        await this.syncCourseAssignments(coopname, course);
      } catch (e) {
        this.logger.warn(`Назначения курса «${course.title}» не сведены: ${(e as Error)?.message ?? e}`);
      }
    }
  }

  async closeAssignment(coopname: string, id: string): Promise<EdubridgeTeacherAssignmentEntity> {
    const a = await this.teachers.findAssignment(coopname, id);
    if (!a) throw DomainError.notFound('EDUBRIDGE_ASSIGNMENT_NOT_FOUND');
    a.status = EduAssignmentStatus.CLOSED;
    return this.teachers.saveAssignment(a);
  }

  /**
   * Первая подпись приложения — преподавателя. В цепь уходит `signannex`,
   * назначение ждёт подписи председателя; активным станет по коллбэку совета
   * (`onAnnexApproved`). Отклонённое приложение подписывается заново.
   */
  async signAnnex(coopname: string, teacher: string, assignmentId: string, document: ISignedDocument): Promise<EdubridgeTeacherAssignmentEntity> {
    await this.requireContract(coopname, teacher);
    const a = await this.teachers.findAssignment(coopname, assignmentId);
    if (!a) throw DomainError.notFound('EDUBRIDGE_ASSIGNMENT_NOT_FOUND');
    if (a.teacher_username !== teacher) throw DomainError.forbidden('EDUBRIDGE_ASSIGNMENT_FOREIGN');
    if (a.status !== EduAssignmentStatus.DRAFT && a.status !== EduAssignmentStatus.DECLINED) {
      throw DomainError.badRequest('EDUBRIDGE_ANNEX_ALREADY_SIGNED');
    }
    if (!document.signatures?.some((s) => s.signer === teacher)) throw DomainError.badRequest('EDUBRIDGE_ANNEX_NOT_SIGNED_BY_TEACHER');
    const course = await this.courses.findById(coopname, a.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_ASSIGNMENT_COURSE_NOT_FOUND');

    await this.chain.signAnnex({
      coopname,
      username: teacher,
      course_id: Number(course.chain_ref),
      annex_hash: document.hash,
      annex: document as never,
    });
    this.logger.info(`[EDU.TEACH] ${teacher}: приложение ${document.hash} по курсу «${course.title}» подписано, ждёт подписи председателя`);

    a.annex_hash = document.hash.toLowerCase();
    a.status = EduAssignmentStatus.PENDING_APPROVAL;
    a.decline_reason = '';
    return this.teachers.saveAssignment(a);
  }

  /** Коллбэк совета `apprvannex`: председатель подписал приложение — назначение действует. */
  async onAnnexApproved(coopname: string, teacher: string, annexHash: string): Promise<void> {
    const a = await this.teachers.findAssignmentByAnnexHash(coopname, annexHash);
    if (!a || a.teacher_username !== teacher) {
      this.logger.warn(`[EDU.TEACH] apprvannex для неизвестного приложения ${annexHash} (${teacher})`);
      return;
    }
    a.status = EduAssignmentStatus.ACTIVE;
    a.decline_reason = '';
    await this.teachers.saveAssignment(a);
    this.events.emit(EDUBRIDGE_ANNEX_DECIDED_EVENT, { coopname, teacher_username: teacher, assignment_id: a.id, approved: true });
  }

  /** Коллбэк совета `dclineannex`: председатель отказал — назначение отклонено. */
  async onAnnexDeclined(coopname: string, teacher: string, annexHash: string, reason: string): Promise<void> {
    const a = await this.teachers.findAssignmentByAnnexHash(coopname, annexHash);
    if (!a || a.teacher_username !== teacher) return;
    a.status = EduAssignmentStatus.DECLINED;
    a.decline_reason = reason;
    await this.teachers.saveAssignment(a);
    this.events.emit(EDUBRIDGE_ANNEX_DECIDED_EVENT, { coopname, teacher_username: teacher, assignment_id: a.id, approved: false, reason });
  }

  // ── Взносы РИД ─────────────────────────────────────────────────────────────
  listContributions(coopname: string, teacher?: string, statuses?: EduContributionStatus[]) {
    return this.teachers.listContributions(coopname, { teacher, statuses });
  }

  /**
   * Отчёт преподавателя после занятия. Работа овеществляется материалами:
   * записью, конспектом, заданиями. Сумма взноса не вводится руками — она
   * равна часам занятия по ставке преподавателя, поэтому оплата ученика и
   * начисление преподавателю считаются от одного и того же.
   */
  async reportLesson(coopname: string, teacher: string, input: EduLessonReportInputDTO): Promise<EdubridgeLessonEntity> {
    const { contract, assignment: a, course, previous } = await this.lessonContext(coopname, teacher, input);
    const duration = input.duration_minutes ?? course.lesson_minutes;
    const amount = costOfHours(contract.hourly_rate, duration / 60);

    // Занятие, материалы которого сняты с хранения, проводится заново: строка
    // журнала та же, взнос по ней — новый.
    const row = previous?.lesson ?? this.lessons.create({ coopname, course_id: course.id, lesson_number: input.lesson_number });
    Object.assign(row, {
      teacher_username: teacher,
      assignment_id: a.id,
      held_at: input.held_at ? new Date(input.held_at) : new Date(),
      duration_minutes: duration,
      materials: input.materials.map((m) => m.trim()).filter(Boolean),
      topic: input.topic ?? '',
    });
    const lesson = await this.lessons.save(row);

    const attempt = previous?.contribution ? `|${previous.contribution.id}` : '';
    const ridHash = createHash('sha256').update(`${coopname}|${teacher}|${lesson.id}${attempt}`).digest('hex');
    const contribution = await this.teachers.saveContribution(
      this.teachers.createContribution({
        coopname,
        teacher_username: teacher,
        assignment_id: a.id,
        rid_hash: ridHash,
        rid_type: EduRidType.LESSON_RECORDING,
        links: lesson.materials,
        description: lesson.topic || t('edubridge.teacher.lessonContributionDescription', { lessonNumber: lesson.lesson_number, courseTitle: course.title }),
        amount,
        lesson_id: lesson.id,
        // Гарантийный срок — один на курс, от даты начала занятий: пока он
        // идёт, результаты преподавателя в совет не уходят; срок вышел —
        // заявления идут сразу. Окончательную дату ставит акт хранения.
        hold_until: this.guaranteeEnd(course),
        status: EduContributionStatus.DRAFT,
      })
    );

    lesson.contribution_id = contribution.id;
    const saved = await this.lessons.save(lesson);
    this.logger.info(
      `[EDU.LESSON] ${teacher}: занятие № ${lesson.lesson_number} курса ${course.id}, взнос ${amount} держится до ${contribution.hold_until?.toISOString()}`
    );
    return saved;
  }

  /**
   * Что нужно для отчёта о занятии: действующий договор, активное назначение и
   * курс с планом занятий. Занятие вне плана и повторный отчёт отклоняются до
   * записи в журнал.
   */
  private async lessonContext(coopname: string, teacher: string, input: EduLessonReportInputDTO) {
    const contract = await this.requireContract(coopname, teacher);
    const assignment = await this.teachers.findAssignment(coopname, input.assignment_id);
    if (!assignment || assignment.teacher_username !== teacher) throw DomainError.notFound('EDUBRIDGE_ASSIGNMENT_NOT_FOUND');
    if (assignment.status !== EduAssignmentStatus.ACTIVE) {
      throw DomainError.badRequest('EDUBRIDGE_ASSIGNMENT_NOT_ACTIVE');
    }

    const course = await this.courses.findById(coopname, assignment.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    if (input.lesson_number < 1 || input.lesson_number > course.lessons_total) {
      throw DomainError.badRequest('EDUBRIDGE_LESSON_OUT_OF_PLAN', { lessonsTotal: course.lessons_total });
    }
    this.assertLessonReport(input, course, assignment);

    return { contract, assignment, course, previous: await this.previousReport(coopname, course.id, input.lesson_number) };
  }

  /**
   * Прежний отчёт по тому же занятию. Действующий взнос повторный отчёт
   * запрещает; снятый с хранения либо отклонённый — разрешает провести
   * занятие и отчитаться заново.
   */
  private async previousReport(coopname: string, courseId: string, lessonNumber: number) {
    const lesson = await this.lessons.findByNumber(coopname, courseId, lessonNumber);
    if (!lesson) return null;
    const contribution = lesson.contribution_id ? await this.teachers.findContribution(coopname, lesson.contribution_id) : null;
    if (contribution && contribution.status !== EduContributionStatus.DECLINED) {
      throw DomainError.badRequest('EDUBRIDGE_LESSON_REPORT_ALREADY_SUBMITTED', { lessonNumber });
    }
    return { lesson, contribution };
  }

  /** Длительность и дата занятия в отчёте — в границах курса и назначения. */
  private assertLessonReport(input: EduLessonReportInputDTO, course: EdubridgeCourseEntity, assignment: EdubridgeTeacherAssignmentEntity): void {
    const maxMinutes = course.lesson_minutes * MAX_LESSON_STRETCH;
    if (input.duration_minutes && input.duration_minutes > maxMinutes) {
      throw DomainError.badRequest('EDUBRIDGE_LESSON_DURATION_TOO_LONG', { lessonMinutes: course.lesson_minutes, maxMinutes });
    }
    if (input.held_at) {
      const heldAt = new Date(input.held_at);
      if (heldAt.getTime() > Date.now() + CLOCK_SKEW_MS) throw DomainError.badRequest('EDUBRIDGE_LESSON_REPORT_TOO_EARLY');
      if (heldAt < new Date(assignment.period_from)) throw DomainError.badRequest('EDUBRIDGE_LESSON_BEFORE_ASSIGNMENT_PERIOD');
    }
  }

  /**
   * Конец гарантийного срока курса. У неактивированного курса даты начала
   * занятий ещё нет — срок отсчитывается от сегодняшнего дня, и акт хранения
   * пересчитает его при подписи.
   */
  private guaranteeEnd(course: EdubridgeCourseEntity): Date {
    return guaranteeEndsAt(course) ?? new Date(Date.now() + course.guarantee_days * DAY_MS);
  }

  /** Названия курсов по идентификаторам — журнал занятий показывает их, а не ключи. */
  async courseTitles(coopname: string, courseIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(courseIds)];
    const entries = await Promise.all(
      unique.map(async (id): Promise<[string, string]> => [id, (await this.courses.findById(coopname, id))?.title ?? ''])
    );
    return new Map(entries);
  }

  /** Журнал занятий преподавателя — что проведено и на какую сумму оформлено. */
  listLessons(coopname: string, teacher: string): Promise<EdubridgeLessonEntity[]> {
    return this.lessons.findByTeacher(coopname, teacher);
  }

  /**
   * Акт передачи материалов занятия на ответственное хранение (3012) без
   * подписи. Преподаватель подписывает его вместе с заявлением сразу после
   * отчёта: кооператив принимает материалы как имущество и держит их весь
   * гарантийный срок курса.
   */
  async storageAct(coopname: string, teacher: string, contributionId: string): Promise<InnerGeneratedDocument> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.DRAFT) throw DomainError.badRequest('EDUBRIDGE_CONTRIBUTION_ALREADY_HELD');
    const { lesson, course } = await this.holdContext(coopname, c);
    // Акт называет конец гарантийного срока курса — дату, с которой согласился
    // преподаватель; она же уйдёт в цепь.
    c.hold_until = this.guaranteeEnd(course);
    await this.teachers.saveContribution(c);
    const action: Cooperative.Registry.EducationRidStorageAct.Action = {
      registry_id: Cooperative.Registry.EducationRidStorageAct.registry_id,
      coopname,
      username: teacher,
      lang: 'ru',
      rid_hash: c.rid_hash,
      amount: c.amount,
      rid_type: c.rid_type,
      course_title: course.title,
      lesson_number: lesson.lesson_number,
      lesson_topic: lesson.topic || c.description,
      held_at: formatDateTime(lesson.held_at),
      duration_minutes: lesson.duration_minutes,
      materials: c.links ?? [],
      hold_until: formatDate(c.hold_until ?? lesson.held_at),
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /**
   * Приём материалов на ответственное хранение: `holdrid` в цепь. С этого
   * момента их стоимость числится за преподавателем на кошельке хранения
   * (Дт 08 / Кт 76) и ждёт окончания гарантийного срока.
   */
  async holdContribution(coopname: string, teacher: string, contributionId: string, document: ISignedDocument): Promise<EdubridgeContributionEntity> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.DRAFT) throw DomainError.badRequest('EDUBRIDGE_CONTRIBUTION_ALREADY_HELD');
    const { course } = await this.holdContext(coopname, c);
    const holdUntil = c.hold_until ?? this.guaranteeEnd(course);
    // Акт называет другую дату, чем срок курса сейчас: курс активировали либо
    // сдвинули после формирования акта.
    if (Math.abs(this.guaranteeEnd(course).getTime() - holdUntil.getTime()) > DAY_MS) {
      throw DomainError.badRequest('EDUBRIDGE_TRANSFER_ACT_STALE');
    }

    await this.chain.holdRid({
      coopname,
      username: teacher,
      rid_hash: c.rid_hash,
      assignment_id: chainAssignmentId(c),
      amount: c.amount,
      rid_type: c.rid_type,
      hold_until: toChainTimePoint(holdUntil),
      act: document,
    } as never);

    c.storage_act_hash = document.hash.toLowerCase();
    c.status = EduContributionStatus.HELD;
    const saved = await this.teachers.saveContribution(c);
    this.logger.info(`[EDU.RID] материалы ${c.rid_hash} приняты на ответственное хранение до ${holdUntil.toISOString()}`);
    return saved;
  }

  /** Занятие и курс, по которым оформлены материалы. */
  private async holdContext(coopname: string, c: EdubridgeContributionEntity) {
    if (!c.lesson_id) throw DomainError.badRequest('EDUBRIDGE_CONTRIBUTION_WITHOUT_LESSON');
    const lesson = await this.lessons.findById(coopname, c.lesson_id);
    if (!lesson) throw DomainError.notFound('EDUBRIDGE_LESSON_NOT_FOUND');
    const course = await this.courses.findById(coopname, lesson.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    return { lesson, course };
  }

  /** Заявление (3008) без подписи — для ознакомления и подписи на фронте. */
  async statement(coopname: string, teacher: string, contributionId: string): Promise<InnerGeneratedDocument> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    const action: Cooperative.Registry.EducationRidStatement.Action = {
      registry_id: Cooperative.Registry.EducationRidStatement.registry_id,
      coopname,
      username: teacher,
      lang: 'ru',
      rid_hash: c.rid_hash,
      assignment_id: chainAssignmentId(c),
      amount: c.amount,
      rid_type: c.rid_type,
      links: c.links,
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /** Подача: `submitrid` в цепь + проект решения совета с отслеживанием. */
  async submitContribution(coopname: string, teacher: string, contributionId: string, document: ISignedDocument): Promise<EdubridgeContributionEntity> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.HELD) {
      throw DomainError.badRequest(
        c.status === EduContributionStatus.DRAFT ? 'EDUBRIDGE_CONTRIBUTION_NOT_HELD' : 'EDUBRIDGE_CONTRIBUTION_ALREADY_SUBMITTED'
      );
    }
    if (c.statement_document) throw DomainError.badRequest('EDUBRIDGE_STATEMENT_ALREADY_SIGNED');

    // Гарантийный срок материалов ещё идёт: подписанное заявление держится
    // здесь и уходит в совет само по истечении срока. Преподаватель подписывает
    // один раз — повторных действий от него это не требует.
    if (c.hold_until && c.hold_until > new Date()) {
      c.statement_hash = document.hash.toLowerCase();
      c.statement_document = document as unknown as Record<string, unknown>;
      const held = await this.teachers.saveContribution(c);
      this.logger.info(`[EDU.RID] заявление ${c.rid_hash} принято и держится до ${c.hold_until.toISOString()}`);
      return held;
    }

    return this.publishContribution(coopname, teacher, c, document);
  }

  /**
   * Отправка заявления в совет: взнос в цепи и проект решения. Вызывается
   * сразу, когда гарантийного срока нет, и очередью отложенных заявлений — когда
   * срок истёк.
   */
  async publishContribution(
    coopname: string,
    teacher: string,
    c: EdubridgeContributionEntity,
    document: ISignedDocument
  ): Promise<EdubridgeContributionEntity> {
    // Два шага, и оба повторяемы. Заявление в цепи фиксируется в базе сразу:
    // сбой на проекте решения не должен возвращать взнос в очередь подачи, где
    // цепь ответит «уже подано» и заявление застрянет.
    if (c.status === EduContributionStatus.HELD) {
      try {
        await this.chain.submitRid({
          coopname,
          username: teacher,
          rid_hash: c.rid_hash,
          assignment_id: chainAssignmentId(c),
          amount: c.amount,
          rid_type: c.rid_type,
          statement: document,
        } as never);
      } catch (e) {
        if (!ALREADY_SUBMITTED.test((e as Error)?.message ?? '')) throw e;
        this.logger.warn(`[EDU.RID] заявление ${c.rid_hash} уже в цепи — продолжаем с проекта решения`);
      }
      c.statement_hash = document.hash.toLowerCase();
      c.statement_document = document as unknown as Record<string, unknown>;
      c.status = EduContributionStatus.SUBMITTED;
      await this.teachers.saveContribution(c);
    }
    if (c.council_project_hash) return c;

    // Решение совета — платформенный проект свободного решения; по принятию ядро
    // эмитит DecisionTrackedEvent с нашими метаданными.
    const projectId = randomUUID();
    const title = t('edubridge.teacher.ridDecision.title', { teacher, amount: c.amount });
    await this.freeDecisions.createProjectOfFreeDecision({
      id: projectId,
      title,
      question: t('edubridge.teacher.ridDecision.question', { teacher }),
      decision: t('edubridge.teacher.ridDecision.decision', { ridType: c.rid_type, teacher, amount: c.amount, statementHash: c.statement_hash }),
    });
    const project = await this.freeDecisions.generateProjectOfFreeDecisionDocument(
      { project_id: projectId, coopname, username: await this.chairman(coopname), registry_id: Cooperative.Registry.ProjectFreeDecision.registry_id, title },
      {}
    );
    const meta = project.meta as Record<string, any>;
    await this.freeDecisions.publishProjectOfFreeDecision({
      coopname,
      username: await this.chairman(coopname),
      meta: JSON.stringify({ extension: 'edubridge', rid_hash: c.rid_hash, project_id: projectId, title }),
      document: { version: meta?.version || '1.0', hash: project.hash, doc_hash: meta?.doc_hash || project.hash, meta_hash: meta?.meta_hash || project.hash, meta: project.meta, signatures: meta?.signatures || [] },
    });
    await this.tracking.registerTrackingRule({
      hash: project.hash,
      event_type: DecisionEventType.SOVIET_DECISION,
      vars_field: RID_VARS_FIELD,
      metadata: { extension: 'edubridge', rid_hash: c.rid_hash, project_id: projectId },
    });
    c.council_project_hash = project.hash.toLowerCase();
    c.council_agenda_id = await this.lookupAgendaId(coopname, project.hash);
    const saved = await this.teachers.saveContribution(c);
    this.events.emit(EDUBRIDGE_CONTRIBUTION_SUBMITTED_EVENT, { coopname, contribution_id: saved.id, teacher_username: teacher });
    this.logger.info(`[EDU.RID] взнос ${c.rid_hash} подан, проект решения ${project.hash}`);
    return saved;
  }

  /**
   * Подтверждённая рекламация в гарантийный срок: заявление снимается, взнос
   * не оформляется, материал остаётся за преподавателем. После отправки в
   * совет снимать уже нечего — там решение принимает совет.
   */
  async revokeHeldContribution(coopname: string, contributionId: string, reason: string): Promise<EdubridgeContributionEntity> {
    const c = await this.teachers.findContribution(coopname, contributionId);
    if (!c) throw DomainError.notFound('EDUBRIDGE_CONTRIBUTION_NOT_FOUND');
    if (c.status !== EduContributionStatus.HELD && c.status !== EduContributionStatus.DRAFT) {
      throw DomainError.badRequest('EDUBRIDGE_STATEMENT_ALREADY_IN_COUNCIL');
    }

    // Материалы на ответственном хранении снимаются проводкой (Дт 76 / Кт 08):
    // обязательство перед преподавателем и принятое имущество закрываются
    // встречно, паевой фонд не затрагивается.
    if (c.status === EduContributionStatus.HELD) {
      await this.chain.recallRid({ coopname, rid_hash: c.rid_hash, reason } as never);
    }

    c.status = EduContributionStatus.DECLINED;
    c.decline_reason = reason;
    const saved = await this.teachers.saveContribution(c);
    this.logger.info(`[EDU.RID] заявление ${c.rid_hash} снято по рекламации: ${reason}`);
    return saved;
  }

  /**
   * Заявления, у которых гарантийный срок истёк, и поданные в цепь, но не
   * дошедшие до совета из-за сбоя, — их отправляет очередь.
   */
  async publishDueContributions(coopname: string): Promise<number> {
    const due = [
      ...(await this.teachers.findHeldDue(coopname, new Date())).filter((c) => Boolean(c.statement_document)),
      ...(await this.teachers.findSubmittedWithoutProject(coopname)),
    ];
    let published = 0;
    for (const c of due) {
      if (!c.statement_document) continue;
      try {
        await this.publishContribution(coopname, c.teacher_username, c, c.statement_document as unknown as ISignedDocument);
        published += 1;
      } catch (e) {
        this.logger.error(`[EDU.RID] не удалось отправить заявление ${c.rid_hash}: ${(e as Error)?.message ?? e}`);
      }
    }
    return published;
  }

  /**
   * Номер вопроса в повестке совета по хэшу проекта решения: по нему придёт
   * отклонение либо снятие просроченного вопроса. Не нашёлся — заявление
   * остаётся без автоматической пометки, председатель снимает материалы сам.
   */
  private async lookupAgendaId(coopname: string, projectHash: string): Promise<string | null> {
    try {
      const decisions = await this.council.getDecisions(coopname);
      const found = decisions.find((d) => String(d.hash ?? '').toLowerCase() === projectHash.toLowerCase());
      if (found) return String(found.id);
    } catch (e) {
      this.logger.warn(`[EDU.RID] повестка совета не прочитана: ${(e as Error)?.message ?? e}`);
    }
    this.logger.warn(`[EDU.RID] вопрос по проекту ${projectHash} в повестке совета не найден — исход совета сам не отметится`);
    return null;
  }

  /**
   * Совет решения о приёме не принял: отклонил вопрос либо не уложился в срок.
   * Отрицательного протокола у совета не бывает, поэтому заявление только
   * помечается — материалы с хранения снимает председатель (`decline`).
   */
  async onCouncilGaveUp(coopname: string, agendaId: string, outcome: EduCouncilOutcome): Promise<void> {
    const c = await this.teachers.findContributionByAgendaId(coopname, agendaId);
    if (!c || c.status !== EduContributionStatus.SUBMITTED) return;
    c.council_outcome = outcome;
    await this.teachers.saveContribution(c);
    this.logger.info(`[EDU.RID] совет не принял решение по взносу ${c.rid_hash} (${outcome}) — материалы ждут снятия с хранения`);
  }

  /** Совет принял решение: ждём акт преподавателя. */
  @OnEvent(DecisionTrackedEvent.eventName)
  async onDecisionTracked(event: DecisionTrackedEvent): Promise<void> {
    const r = event.result;
    if (!r.matched || r.metadata?.extension !== 'edubridge' || !r.metadata?.rid_hash) return;
    const c = await this.teachers.findContributionByRidHash(String(r.metadata.rid_hash));
    if (!c || c.status !== EduContributionStatus.SUBMITTED) return;
    c.status = EduContributionStatus.COUNCIL_APPROVED;
    c.council_outcome = null;
    c.council_decision_id = r.decision_id ? String(r.decision_id) : null;
    c.decided_at = r.decision_date ? new Date(r.decision_date) : new Date();
    await this.teachers.saveContribution(c);
    this.logger.info(`[EDU.RID] совет принял решение ${r.decision_id} по взносу ${c.rid_hash} — ждём акт преподавателя`);
  }

  /** Акт приёма-передачи (3010) без подписи — после решения совета. */
  async act(coopname: string, teacher: string, contributionId: string): Promise<InnerGeneratedDocument> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.COUNCIL_APPROVED) throw DomainError.badRequest('EDUBRIDGE_ACT_BEFORE_COUNCIL_DECISION');
    const action: Cooperative.Registry.EducationRidAct.Action = {
      registry_id: Cooperative.Registry.EducationRidAct.registry_id,
      coopname,
      username: teacher,
      lang: 'ru',
      rid_hash: c.rid_hash,
      amount: c.amount,
      rid_type: c.rid_type,
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /** Преподаватель подписал акт: сохраняем документ и ждём подпись председателя на нём же. */
  async signAct(coopname: string, teacher: string, contributionId: string, act: ISignedDocument): Promise<EdubridgeContributionEntity> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.COUNCIL_APPROVED) throw DomainError.badRequest('EDUBRIDGE_ACT_BEFORE_COUNCIL_DECISION');
    if (!act.signatures?.some((s) => s.signer === teacher)) throw DomainError.badRequest('EDUBRIDGE_ACT_NOT_SIGNED_BY_TEACHER');
    c.act_hash = act.hash.toLowerCase();
    c.act_signed = act as unknown as Record<string, unknown>;
    c.status = EduContributionStatus.ACT_SIGNED;
    const saved = await this.teachers.saveContribution(c);
    this.logger.info(`[EDU.RID] акт ${c.act_hash} подписан преподавателем — ждём подпись председателя`);
    return saved;
  }

  /** Агрегат акта для второй подписи: тот же документ, без перегенерации. */
  async actSignablePayload(coopname: string, contributionId: string): Promise<InnerDocumentAggregate> {
    const c = await this.teachers.findContribution(coopname, contributionId);
    if (!c) throw DomainError.notFound('EDUBRIDGE_CONTRIBUTION_NOT_FOUND');
    if (c.status !== EduContributionStatus.ACT_SIGNED || !c.act_signed) throw DomainError.badRequest('EDUBRIDGE_ACT_NOT_YET_SIGNED_BY_TEACHER');
    const aggregate = await this.documents.buildAggregate(c.act_signed as unknown as ISignedDocument);
    if (!aggregate) throw DomainError.notFound('EDUBRIDGE_ACT_NOT_IN_REGISTRY');
    return aggregate;
  }

  /**
   * Председатель подписал тот же акт (вторая подпись по хэшу) → протокол (3009)
   * + акт с двумя подписями → `acceptrid`: проводка Дт 04 / Кт 80, право требования.
   */
  async acceptContribution(coopname: string, chairman: string, contributionId: string, act: ISignedDocument): Promise<EdubridgeContributionEntity> {
    const c = await this.teachers.findContribution(coopname, contributionId);
    if (!c) throw DomainError.notFound('EDUBRIDGE_CONTRIBUTION_NOT_FOUND');
    if (c.status !== EduContributionStatus.ACT_SIGNED) throw DomainError.badRequest('EDUBRIDGE_ACT_NOT_YET_SIGNED_BY_TEACHER');
    if (act.hash.toLowerCase() !== c.act_hash) throw DomainError.badRequest('EDUBRIDGE_ACT_HASH_MISMATCH');
    const signers = new Set((act.signatures ?? []).map((s) => s.signer));
    if (!signers.has(c.teacher_username) || !signers.has(chairman)) {
      throw DomainError.badRequest('EDUBRIDGE_ACT_SIGNATURES_REQUIRED');
    }
    const decision = await this.documents.generate({
      data: {
        registry_id: Cooperative.Registry.EducationRidDecision.registry_id,
        coopname,
        username: await this.chairman(coopname),
        lang: 'ru',
        rid_hash: c.rid_hash,
        amount: c.amount,
        decision_id: Number(c.council_decision_id ?? 0),
        skip_save: false,
      } as Cooperative.Registry.EducationRidDecision.Action,
    });
    await this.chain.acceptRid({ coopname, rid_hash: c.rid_hash, decision: this.unsigned(decision), act } as never);
    await this.settleReserve(coopname, c);
    c.decision_hash = decision.hash.toLowerCase();
    c.act_signed = act as unknown as Record<string, unknown>;
    c.status = EduContributionStatus.ACCEPTED;
    const saved = await this.teachers.saveContribution(c);
    this.events.emit(EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT, { coopname, contribution_id: saved.id, teacher_username: c.teacher_username, accepted: true });
    this.logger.info(`[EDU.RID] взнос ${c.rid_hash} принят — acceptrid, право требования в кошельке ${c.teacher_username}`);
    return saved;
  }

  /**
   * Цепь при приёме списала резерв преподавателям на стоимость результата —
   * обязательство по курсу уменьшается на ту же сумму. Сбой учёта приём не
   * отменяет: результат уже в паевом фонде.
   */
  private async settleReserve(coopname: string, c: EdubridgeContributionEntity): Promise<void> {
    try {
      const assignment = await this.teachers.findAssignment(coopname, c.assignment_id);
      if (assignment) await this.funds.onSettled(coopname, assignment.course_id, c.amount);
    } catch (e) {
      this.logger.error(`[EDU.RID] резерв по курсу после приёма ${c.rid_hash} не обновлён: ${(e as Error)?.message ?? e}`);
    }
  }

  async decline(coopname: string, contributionId: string, reason: string): Promise<EdubridgeContributionEntity> {
    const c = await this.teachers.findContribution(coopname, contributionId);
    if (!c) throw DomainError.notFound('EDUBRIDGE_CONTRIBUTION_NOT_FOUND');
    if (![EduContributionStatus.SUBMITTED, EduContributionStatus.COUNCIL_APPROVED, EduContributionStatus.ACT_SIGNED].includes(c.status)) {
      throw DomainError.badRequest('EDUBRIDGE_CONTRIBUTION_DECLINE_NOT_SUBMITTED');
    }
    if (!reason?.trim()) throw DomainError.badRequest('EDUBRIDGE_CONTRIBUTION_DECLINE_REASON_REQUIRED');
    if (c.council_decision_id) {
      // Решение совета есть, приём не состоялся: заявление закрывается его протоколом.
      const decision = await this.documents.generate({
        data: {
          registry_id: Cooperative.Registry.EducationRidDecision.registry_id,
          coopname,
          username: await this.chairman(coopname),
          lang: 'ru',
          rid_hash: c.rid_hash,
          amount: c.amount,
          decision_id: Number(c.council_decision_id),
          skip_save: false,
        } as Cooperative.Registry.EducationRidDecision.Action,
      });
      await this.chain.declineRid({ coopname, rid_hash: c.rid_hash, decision: this.unsigned(decision) } as never);
      c.decision_hash = decision.hash.toLowerCase();
    } else {
      // Совет решения не принял — отрицательного протокола у него не бывает.
      // Материалы снимаются с хранения с основанием (Дт 76 / Кт 08).
      await this.chain.recallRid({ coopname, rid_hash: c.rid_hash, reason: t('edubridge.teacher.ridRecallReason', { reason: reason.trim() }) } as never);
    }
    c.decline_reason = reason;
    c.status = EduContributionStatus.DECLINED;
    c.decided_at = new Date();
    const saved = await this.teachers.saveContribution(c);
    this.events.emit(EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT, { coopname, contribution_id: saved.id, teacher_username: c.teacher_username, accepted: false });
    return saved;
  }

  // ── Расчёт ─────────────────────────────────────────────────────────────────
  async settlement(coopname: string, teacher: string): Promise<EduTeacherSettlementDTO> {
    const accepted = await this.teachers.listContributions(coopname, { teacher, statuses: [EduContributionStatus.ACCEPTED] });
    const symbol = accepted[0]?.amount.split(' ')[1] ?? platformSettings().blockchain.rootGovernSymbol;
    const total = accepted.reduce((s, c) => s + parseFloat(c.amount), 0);
    const wallet = await this.wallets.findByWalletAndUsername(coopname, SHARE_WALLET, teacher);
    const available = Number.parseFloat(wallet?.available ?? '0');
    return {
      accepted_total: `${total.toFixed(4)} ${symbol}`,
      available: `${(Number.isNaN(available) ? 0 : available).toFixed(4)} ${symbol}`,
      last_accepted_at: accepted.map((c) => c.decided_at).filter(Boolean).sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? null,
    };
  }

  private async ownContribution(coopname: string, teacher: string, id: string): Promise<EdubridgeContributionEntity> {
    const c = await this.teachers.findContribution(coopname, id);
    if (!c) throw DomainError.notFound('EDUBRIDGE_CONTRIBUTION_NOT_FOUND');
    if (c.teacher_username !== teacher) throw DomainError.forbidden('EDUBRIDGE_CONTRIBUTION_FOREIGN');
    return c;
  }

  private unsigned(doc: InnerGeneratedDocument): ISignedDocument {
    const meta = doc.meta as Record<string, any>;
    return { version: meta?.version || '1.0', hash: doc.hash, doc_hash: meta?.doc_hash || doc.hash, meta_hash: meta?.meta_hash || doc.hash, meta: doc.meta as ISignedDocument['meta'], signatures: [] };
  }

  private async chairman(_coopname: string): Promise<string> {
    return platformSettings().coopname; // документы совета формируются от имени кооператива
  }
}

/**
 * Номер задания в цепи. Приём на хранение, заявление и его текст обязаны
 * называть одно и то же число: `submitrid` сверяет его с принятым на хранение.
 */
function chainAssignmentId(c: EdubridgeContributionEntity): number {
  return Number(new Date(c.created_at).getTime() % 1_000_000);
}

/** Числовое значение ставки часа («1000.0000 RUB» → 1000). */
/**
 * Покрывают ли взносы учеников ставку преподавателя: взнос посчитан от
 * плановой ставки курса, и ставка выше неё резервом выплат не обеспечена.
 * Текст отказа либо `null`. Одна проверка для назначения и для формы курса.
 */
export function rateCoverageError(
  contractRate: string | null | undefined,
  plannedRate: string | null | undefined,
  teacher?: string
): DomainError | null {
  if (rateValue(contractRate) <= rateValue(plannedRate)) return null;
  return teacher
    ? DomainError.badRequest('EDUBRIDGE_COURSE_TEACHER_RATE_NOT_COVERED', { teacher, contractRate, plannedRate })
    : DomainError.badRequest('EDUBRIDGE_TEACHER_RATE_NOT_COVERED', { contractRate, plannedRate });
}

/**
 * Период назначения по курсу: от начала занятий (или сегодня) на весь срок
 * программы — столько месяцев, сколько нужно на все занятия.
 */
export function coursePeriod(course: Pick<EdubridgeCourseEntity, 'starts_at' | 'lessons_total' | 'lessons_per_month'>): { from: string; to: string } {
  const from = course.starts_at ? String(course.starts_at).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const months = Math.max(1, Math.ceil((course.lessons_total || 0) / Math.max(1, course.lessons_per_month || 1)));
  const start = new Date(`${from}T00:00:00Z`);
  // День прижимается к концу месяца: от 31 января месяц кончается в феврале, а не в марте.
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay) - 1);
  return { from, to: target.toISOString().slice(0, 10) };
}

function rateValue(rate: string | null | undefined): number {
  return Number(String(rate ?? '').trim().split(' ')[0] ?? 0) || 0;
}

/** Ставка задана, когда сумма больше нуля: «0.0000 RUB» — ещё не названа. */
function isPositiveRate(rate: string | null | undefined): boolean {
  return rateValue(rate) > 0;
}
