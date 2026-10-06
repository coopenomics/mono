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
  EdubridgeContributionRecord,
  EdubridgeCourseRecord,
  EdubridgeLessonRecord,
  EdubridgeTeacherAssignmentRecord,
  EdubridgeTeacherContractRecord,
} from '../../infrastructure/entities';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { costOfHours } from '../../domain/economy/course-fee.calculator';
import { EdubridgeTeacherKyselyRepository } from '../../infrastructure/repositories/edubridge-teacher.kysely-repository';
import type {
  EduAssignmentInputDTO,
  EduLessonReportInputDTO,
  EduTeacherDTO,
  EduTeacherProfileDTO,
  EduTeacherProfileInputDTO,
  EduTeacherSettlementDTO,
} from '../dto/edu-teacher.dto';
import { EdubridgeNamesService } from '../membership/edubridge-names.service';
import {
  EDUBRIDGE_CONTRACT_DECIDED_EVENT,
  EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT,
  EDUBRIDGE_CONTRIBUTION_SUBMITTED_EVENT,
} from '../events/edubridge.events';
import { t } from '../../i18n';

const SHARE_WALLET = 'w.wal.share';
/** Паевой взнос преподавателя по программе — сюда зачисляется принятый результат. */
const PROGRAM_SHARE_WALLET = 'w.edu.share';
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

/** Сумма, на которую подписано заявление о трансляции паевого взноса. */
function statementAmount(document: ISignedDocument): string {
  const raw = document.meta as unknown;
  try {
    const meta = (typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}) as Record<string, unknown>;
    return String(meta.amount ?? '');
  } catch {
    return '';
  }
}

/**
 * Преподавательский контур: ДУХД → допуск к курсу (назначение) → взнос РИД по
 * заявлению → решение совета (платформенный проект свободного решения) →
 * акт приёма-передачи → `acceptrid` (Дт 04 / Кт 08 и Дт 76 / Кт 80, паевой
 * взнос на кошельке программы) → заявление о трансляции в «Цифровой Кошелёк»
 * (`wthshare`); возврат паевого взноса — оттуда штатным механизмом платформы.
 *
 * Договор УХД — двухподписный, как в «Благоросте»: преподаватель подписывает
 * первым (`signcontract`), контракт ставит документ в очередь одобрений
 * совета, председатель подписывает вторым со стола «Запросы одобрений», и
 * коллбэк совета (`apprvcontr`) делает договор действующим — статус здесь
 * переводит слушатель этого действия, а не сама мутация.
 *
 * Допуск к курсу — рабочее назначение без документа: действует с момента,
 * когда администратор поставил преподавателя на курс, и снимается, когда
 * убрал. Список «Курс ведут» и действующие назначения — одно и то же.
 */
@Injectable()
export class EdubridgeTeacherService {
  constructor(
    private readonly teachers: EdubridgeTeacherKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly lessons: EdubridgeLessonKyselyRepository,
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
  async signContract(coopname: string, teacher: string, document: ISignedDocument, number: string, declaredRate?: string | null) {
    const existing = await this.teachers.findContract(coopname, teacher);
    if (existing && !RESIGNABLE_CONTRACT.includes(existing.status)) return existing;
    if (!document.signatures?.some((s) => s.signer === teacher)) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_NOT_SIGNED_BY_TEACHER');
    const hourlyRate = await this.requireDeclaredRate(coopname, teacher, declaredRate);
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
      contract_document: document as unknown as Record<string, unknown>,
      hourly_rate: hourlyRate,
      status: EduContractStatus.PENDING_APPROVAL,
      decline_reason: '',
      approved_at: null,
    });
  }

  /**
   * Председатель подписал договор: в записи остаётся документ уже с двумя
   * подписями — его и показывает карточка преподавателя.
   */
  async saveApprovedContractDocument(coopname: string, contractHash: string, document: ISignedDocument | undefined): Promise<void> {
    if (!document?.hash) return;
    const c = await this.teachers.findContractByHash(coopname, contractHash);
    if (!c) return;
    c.contract_document = document as unknown as Record<string, unknown>;
    await this.teachers.saveContract(c);
  }

  /** Документ договора для просмотра; `null` — документ в записи не сохранён. */
  async contractDocument(coopname: string, teacher: string): Promise<InnerDocumentAggregate | null> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c?.contract_document) return null;
    return this.documents.buildAggregate(c.contract_document as unknown as ISignedDocument);
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
  async onContractApproved(coopname: string, contractHash: string): Promise<void> {
    // Договор ищется по hash: в обратном вызове совета стоит имя подписавшего председателя.
    const c = await this.teachers.findContractByHash(coopname, contractHash);
    if (!c) {
      this.logger.warn(`[EDU.TEACH] apprvcontr для неизвестного договора ${contractHash}`);
      return;
    }
    const teacher = c.teacher_username;
    // Статус мог уже прийти дельтой — дату подписи из цепи не перетираем.
    c.status = EduContractStatus.ACTIVE;
    c.approved_at = c.approved_at ?? new Date();
    c.decline_reason = '';
    await this.teachers.saveContract(c);
    this.events.emit(EDUBRIDGE_CONTRACT_DECIDED_EVENT, { coopname, teacher_username: teacher, contract_hash: c.contract_hash, approved: true });
  }

  /** Коллбэк совета `dclinecontr`: председатель отказал — договор можно подписать заново. */
  async onContractDeclined(coopname: string, contractHash: string, reason: string): Promise<void> {
    const c = await this.teachers.findContractByHash(coopname, contractHash);
    if (!c) return;
    const teacher = c.teacher_username;
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
  async terminateContract(coopname: string, teacher: string, reason: string): Promise<EdubridgeTeacherContractRecord | null> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c || RESIGNABLE_CONTRACT.includes(c.status)) return c;
    if (!reason?.trim()) throw DomainError.badRequest('EDUBRIDGE_CONTRACT_TERMINATION_REASON_REQUIRED');

    const openAssignments = (await this.teachers.listAssignments(coopname, { teacher })).filter(
      (a) => a.status === EduAssignmentStatus.ACTIVE
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

  /**
   * Ставка для договора: названа первым шагом подключения и лежит в профиле;
   * явная ставка в запросе имеет приоритет. Без ставки договор не
   * подписывается: по ней считается и стоимость курса, и взнос преподавателя
   * за занятие.
   */
  private async requireDeclaredRate(coopname: string, teacher: string, declaredRate?: string | null): Promise<string> {
    const rate = declaredRate || (await this.teachers.findProfile(coopname, teacher))?.hourly_rate || '';
    if (!isPositiveRate(rate)) throw DomainError.badRequest('EDUBRIDGE_TEACHER_RATE_REQUIRED');
    return rate;
  }

  // ── Профиль преподавателя ──────────────────────────────────────────────────
  /**
   * Профиль преподавателя: что он рассказал о себе и его ставка часа. Пока
   * договора нет, ставка — названная при подключении; с договором — ставка
   * договора, и преподаватель её уже не меняет (это делает администратор).
   */
  async profile(coopname: string, teacher: string): Promise<EduTeacherProfileDTO> {
    const [profile, contract] = await Promise.all([this.teachers.findProfile(coopname, teacher), this.teachers.findContract(coopname, teacher)]);
    const rate_locked = rateLockedBy(contract);
    return {
      about: profile?.about ?? '',
      hourly_rate: rate_locked ? (contract as EdubridgeTeacherContractRecord).hourly_rate : profile?.hourly_rate ?? ZERO_RATE,
      rate_locked,
    };
  }

  /**
   * Первый шаг подключения и правка «о себе» со стола. Рассказ о себе
   * обязателен — иначе в карточке преподавателя пусто, и администратору не по
   * чему судить, кого он допускает к курсу. Ставку преподаватель называет до
   * договора; после подписи договора она закреплена.
   */
  async saveProfile(coopname: string, teacher: string, input: EduTeacherProfileInputDTO): Promise<EduTeacherProfileDTO> {
    const about = (input.about ?? '').trim();
    if (!about) throw DomainError.badRequest('EDUBRIDGE_TEACHER_ABOUT_REQUIRED');
    const [existing, contract] = await Promise.all([this.teachers.findProfile(coopname, teacher), this.teachers.findContract(coopname, teacher)]);

    let hourly_rate: string;
    if (rateLockedBy(contract)) {
      hourly_rate = (contract as EdubridgeTeacherContractRecord).hourly_rate;
      if (input.hourly_rate && input.hourly_rate !== hourly_rate) throw DomainError.badRequest('EDUBRIDGE_TEACHER_RATE_ALREADY_SET');
    } else {
      hourly_rate = input.hourly_rate || existing?.hourly_rate || ZERO_RATE;
      if (!isPositiveRate(hourly_rate)) throw DomainError.badRequest('EDUBRIDGE_TEACHER_RATE_REQUIRED');
    }

    await this.teachers.saveProfile({ ...(existing ?? {}), coopname, teacher_username: teacher, about, hourly_rate });
    return this.profile(coopname, teacher);
  }

  private async requireContract(coopname: string, teacher: string): Promise<EdubridgeTeacherContractRecord> {
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
    const [names, avatars, assignments, profiles] = await Promise.all([
      this.names.displayNames(usernames),
      this.avatars.getAvatarUrls(usernames),
      this.teachers.listAssignments(coopname),
      this.teachers.listProfiles(coopname),
    ]);
    const aboutOf = new Map(profiles.map((p) => [p.teacher_username, p.about]));
    return contracts.map((c) => {
      const own = assignments.filter((a) => a.teacher_username === c.teacher_username);
      return {
        username: c.teacher_username,
        hourly_rate: c.hourly_rate,
        display_name: names.get(c.teacher_username) ?? '',
        about: aboutOf.get(c.teacher_username) ?? '',
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

  async createAssignment(coopname: string, input: EduAssignmentInputDTO): Promise<EdubridgeTeacherAssignmentRecord> {
    const course = await this.courses.findById(coopname, input.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    if (input.period_to < input.period_from) throw DomainError.badRequest('EDUBRIDGE_ASSIGNMENT_PERIOD_INVALID');
    const contract = await this.assertCanTeach(coopname, input.teacher_username.trim());
    const hourlyRate = rateOnCourse(input.hourly_rate, contract.hourly_rate, course.planned_hourly_rate);
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
      hourly_rate: hourlyRate,
      status: EduAssignmentStatus.ACTIVE,
    });
    const saved = await this.teachers.saveAssignment(entity);
    // Список «Курс ведут» и допуски — одно и то же: допущенный стоит в курсе.
    if (!(course.teacher_usernames ?? []).includes(saved.teacher_username)) {
      course.teacher_usernames = [...(course.teacher_usernames ?? []), saved.teacher_username];
      await this.courses.save(course);
    }
    return saved;
  }

  /**
   * К курсу допускается пайщик с договором участия в хозяйственной
   * деятельности — подписанным им и действующим либо на подписи у
   * председателя; форма курса проверяет то же самое.
   */
  private async assertCanTeach(coopname: string, teacher: string): Promise<EdubridgeTeacherContractRecord> {
    const contract = await this.teachers.findContract(coopname, teacher);
    if (!contract || !grantsTeaching(contract)) throw withoutContractError([teacher]);
    return contract;
  }

  /**
   * Ставка часа преподавателя на курсе. Взнос учеников посчитан от плановой
   * ставки курса, и в резерв выплат преподавателям направляется именно она,
   * поэтому ставка на курсе не бывает выше плановой — без исключений: разницу
   * пришлось бы брать из средств других курсов.
   */
  async setAssignmentRate(coopname: string, assignmentId: string, hourlyRate: string): Promise<EdubridgeTeacherAssignmentRecord> {
    const a = await this.teachers.findAssignment(coopname, assignmentId);
    if (!a) throw DomainError.notFound('EDUBRIDGE_ASSIGNMENT_NOT_FOUND');
    const course = await this.courses.findById(coopname, a.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    if (!isPositiveRate(hourlyRate)) throw DomainError.badRequest('EDUBRIDGE_TEACHER_RATE_REQUIRED');
    const error = rateCoverageError(hourlyRate, course.planned_hourly_rate);
    if (error) throw error;
    a.hourly_rate = hourlyRate;
    return this.teachers.saveAssignment(a);
  }

  /** Плановая ставка курса снижена — ставки действующих допусков опускаются до неё. */
  private async capAssignmentRates(course: EdubridgeCourseRecord, assignments: EdubridgeTeacherAssignmentRecord[]): Promise<void> {
    for (const a of assignments) {
      if (a.status !== EduAssignmentStatus.ACTIVE || !rateCoverageError(a.hourly_rate, course.planned_hourly_rate)) continue;
      a.hourly_rate = course.planned_hourly_rate;
      await this.teachers.saveAssignment(a);
      this.logger.info(`Ставка на курсе опущена до плановой: ${a.teacher_username} → «${course.title}»`);
    }
  }

  /**
   * Допуски по списку «Курс ведут». Преподаватель, добавленный в курс, сразу
   * получает действующее назначение и видит курс на своём столе; у убранного
   * из курса допуск снимается. Идемпотентно.
   */
  async syncCourseAssignments(coopname: string, course: EdubridgeCourseRecord): Promise<void> {
    const listed = new Set(course.teacher_usernames ?? []);
    const forCourse = (await this.teachers.listAssignments(coopname)).filter((a) => a.course_id === course.id);
    const period = coursePeriod(course);
    await this.capAssignmentRates(course, forCourse.filter((a) => listed.has(a.teacher_username)));
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
      this.logger.info(`Допуск к курсу: ${teacher} → «${course.title}»`);
    }
    for (const a of forCourse) {
      if (!listed.has(a.teacher_username) && a.status === EduAssignmentStatus.ACTIVE) {
        a.status = EduAssignmentStatus.CLOSED;
        await this.teachers.saveAssignment(a);
        this.logger.info(`Допуск снят: ${a.teacher_username} → «${course.title}»`);
      }
    }
  }

  /** Допуски по всем курсам — при запуске: курсы, заполненные до появления связи. */
  async syncAllCourseAssignments(coopname: string): Promise<void> {
    for (const course of await this.courses.listAll(coopname)) {
      try {
        await this.syncCourseAssignments(coopname, course);
      } catch (e) {
        this.logger.warn(`Назначения курса «${course.title}» не сведены: ${(e as Error)?.message ?? e}`);
      }
    }
  }

  async closeAssignment(coopname: string, id: string): Promise<EdubridgeTeacherAssignmentRecord> {
    const a = await this.teachers.findAssignment(coopname, id);
    if (!a) throw DomainError.notFound('EDUBRIDGE_ASSIGNMENT_NOT_FOUND');
    a.status = EduAssignmentStatus.CLOSED;
    const saved = await this.teachers.saveAssignment(a);
    // Снятый допуск убирает преподавателя и из списка «Курс ведут» — иначе
    // сверка по курсу выдала бы назначение заново.
    const course = await this.courses.findById(coopname, a.course_id);
    if (course && (course.teacher_usernames ?? []).includes(a.teacher_username)) {
      course.teacher_usernames = (course.teacher_usernames ?? []).filter((u) => u !== a.teacher_username);
      await this.courses.save(course);
    }
    return saved;
  }

  // ── Взносы РИД ─────────────────────────────────────────────────────────────
  listContributions(coopname: string, teacher?: string, statuses?: EduContributionStatus[]) {
    return this.teachers.listContributions(coopname, { teacher, statuses });
  }

  /**
   * Сумма взноса за занятие в пределах курса. Преподаватель получает за часы,
   * оплаченные учениками этого курса: обязательство курса — стоимость часов по
   * плановой ставке за оплаченное время за вычетом уже выплаченного. Из него
   * вычитаются взносы курса, которые ещё не приняты. Остатка нет — занятие
   * учениками не оплачено, и отчёт по нему не принимается: платить за него
   * пришлось бы средствами других курсов.
   */
  private async amountWithinCourse(coopname: string, course: EdubridgeCourseRecord, amount: string, replacedContributionId?: string): Promise<string> {
    const symbol = amount.split(' ')[1] ?? '';
    const obligation = rateValue((await this.funds.target(coopname, course)).obligation);
    const ofCourse = new Set((await this.teachers.listAssignments(coopname)).filter((x) => x.course_id === course.id).map((x) => x.id));
    const promised = (await this.teachers.listContributions(coopname, { statuses: PENDING_CONTRIBUTION_STATUSES }))
      .filter((c) => ofCourse.has(c.assignment_id) && c.id !== replacedContributionId)
      .reduce((sum, c) => sum + rateValue(c.amount), 0);
    const available = Math.round((obligation - promised) * 10000) / 10000;
    if (!(available > 0)) throw DomainError.badRequest('EDUBRIDGE_LESSON_NOT_PAID_BY_LEARNERS', { courseTitle: course.title });
    return rateValue(amount) <= available ? amount : `${available.toFixed(4)} ${symbol}`;
  }

  /**
   * Отчёт преподавателя после занятия. Работа овеществляется материалами:
   * записью, конспектом, заданиями. Сумма взноса не вводится руками — она
   * равна часам занятия по ставке преподавателя, поэтому оплата ученика и
   * начисление преподавателю считаются от одного и того же.
   */
  async reportLesson(coopname: string, teacher: string, input: EduLessonReportInputDTO): Promise<EdubridgeLessonRecord> {
    const { contract, assignment: a, course, previous } = await this.lessonContext(coopname, teacher, input);
    const duration = input.duration_minutes ?? course.lesson_minutes;
    // Взнос за занятие считается по ставке преподавателя на этом курсе и не
    // превышает оплаченного учениками по курсу.
    const amount = await this.amountWithinCourse(
      coopname,
      course,
      costOfHours(isPositiveRate(a.hourly_rate) ? a.hourly_rate : contract.hourly_rate, duration / 60),
      previous?.contribution?.id
    );

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
  private assertLessonReport(input: EduLessonReportInputDTO, course: EdubridgeCourseRecord, assignment: EdubridgeTeacherAssignmentRecord): void {
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
  private guaranteeEnd(course: EdubridgeCourseRecord): Date {
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
  listLessons(coopname: string, teacher: string): Promise<EdubridgeLessonRecord[]> {
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
  async holdContribution(coopname: string, teacher: string, contributionId: string, document: ISignedDocument): Promise<EdubridgeContributionRecord> {
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
      course_id: Number(course.chain_ref),
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
  private async holdContext(coopname: string, c: EdubridgeContributionRecord) {
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
  async submitContribution(coopname: string, teacher: string, contributionId: string, document: ISignedDocument): Promise<EdubridgeContributionRecord> {
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
    c: EdubridgeContributionRecord,
    document: ISignedDocument
  ): Promise<EdubridgeContributionRecord> {
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
  async revokeHeldContribution(coopname: string, contributionId: string, reason: string): Promise<EdubridgeContributionRecord> {
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
      // Акт называет протокол совета, которым принят взнос.
      ...(c.council_decision_id ? { decision_id: Number(c.council_decision_id), decision_date: formatDate(c.decided_at ?? new Date()) } : {}),
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /** Преподаватель подписал акт: сохраняем документ и ждём подпись председателя на нём же. */
  async signAct(coopname: string, teacher: string, contributionId: string, act: ISignedDocument): Promise<EdubridgeContributionRecord> {
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
  async acceptContribution(coopname: string, chairman: string, contributionId: string, act: ISignedDocument): Promise<EdubridgeContributionRecord> {
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
        username: c.teacher_username,
        lang: 'ru',
        rid_hash: c.rid_hash,
        rid_type: c.rid_type,
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
  private async settleReserve(coopname: string, c: EdubridgeContributionRecord): Promise<void> {
    try {
      const assignment = await this.teachers.findAssignment(coopname, c.assignment_id);
      if (assignment) await this.funds.onSettled(coopname, assignment.course_id, c.amount);
    } catch (e) {
      this.logger.error(`[EDU.RID] резерв по курсу после приёма ${c.rid_hash} не обновлён: ${(e as Error)?.message ?? e}`);
    }
  }

  async decline(coopname: string, contributionId: string, reason: string): Promise<EdubridgeContributionRecord> {
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
          username: c.teacher_username,
          lang: 'ru',
          rid_hash: c.rid_hash,
          rid_type: c.rid_type,
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
    const [programShare, available] = await Promise.all([
      this.walletAvailable(coopname, PROGRAM_SHARE_WALLET, teacher),
      this.walletAvailable(coopname, SHARE_WALLET, teacher),
    ]);
    return {
      accepted_total: `${total.toFixed(4)} ${symbol}`,
      program_share: `${programShare.toFixed(4)} ${symbol}`,
      available: `${available.toFixed(4)} ${symbol}`,
      last_accepted_at: accepted.map((c) => c.decided_at).filter(Boolean).sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? null,
    };
  }

  private async walletAvailable(coopname: string, walletName: string, username: string): Promise<number> {
    const wallet = await this.wallets.findByWalletAndUsername(coopname, walletName, username);
    const available = Number.parseFloat(wallet?.available ?? '0');
    return Number.isNaN(available) ? 0 : available;
  }

  // ── Трансляция паевого взноса в «Цифровой Кошелёк» ─────────────────────────
  /** Заявление о трансляции паевого взноса (3015) без подписи — на сумму, которую назвал преподаватель. */
  async shareWithdrawStatement(coopname: string, teacher: string, amount: string): Promise<InnerGeneratedDocument> {
    const asset = await this.withdrawableAmount(coopname, teacher, amount);
    const action: Cooperative.Registry.EducationShareWithdrawStatement.Action = {
      registry_id: Cooperative.Registry.EducationShareWithdrawStatement.registry_id,
      coopname,
      username: teacher,
      lang: 'ru',
      amount: asset,
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /**
   * Трансляция по подписанному заявлению: `wthshare` в цепь, сумма переходит с
   * паевого кошелька программы на главный паевой. Возврат паевого взноса
   * преподаватель оформляет уже в «Цифровом Кошельке».
   */
  async withdrawShare(coopname: string, teacher: string, amount: string, document: ISignedDocument): Promise<EduTeacherSettlementDTO> {
    const asset = await this.withdrawableAmount(coopname, teacher, amount);
    // Преподаватель подписал заявление на конкретную сумму: в цепь уходит она же.
    if (statementAmount(document) !== asset) throw DomainError.badRequest('EDUBRIDGE_SHARE_WITHDRAW_STATEMENT_STALE');
    await this.chain.withdrawShare({ coopname, username: teacher, amount: asset, statement: document } as never);
    this.logger.info(`[EDU.RID] паевой взнос ${asset} преподавателя ${teacher} транслирован в Цифровой Кошелёк`);
    return this.settlement(coopname, teacher);
  }

  /** Сумма трансляции в виде цепи: больше нуля и не больше остатка паевого кошелька программы. */
  private async withdrawableAmount(coopname: string, teacher: string, amount: string): Promise<string> {
    const { rootGovernSymbol, rootGovernPrecision } = platformSettings().blockchain;
    const [value, symbol] = amount.trim().split(/\s+/);
    const parsed = Number.parseFloat(value ?? '');
    if (!Number.isFinite(parsed) || parsed <= 0 || (symbol && symbol !== rootGovernSymbol)) {
      throw DomainError.badRequest('EDUBRIDGE_SHARE_WITHDRAW_AMOUNT_INVALID');
    }
    const asset = `${parsed.toFixed(rootGovernPrecision)} ${rootGovernSymbol}`;
    const programShare = await this.walletAvailable(coopname, PROGRAM_SHARE_WALLET, teacher);
    if (Number.parseFloat(asset) > programShare) throw DomainError.badRequest('EDUBRIDGE_SHARE_WITHDRAW_INSUFFICIENT');
    return asset;
  }

  private async ownContribution(coopname: string, teacher: string, id: string): Promise<EdubridgeContributionRecord> {
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
function chainAssignmentId(c: EdubridgeContributionRecord): number {
  return Number(new Date(c.created_at).getTime() % 1_000_000);
}

/** Числовое значение ставки часа («1000.0000 RUB» → 1000). */
/** Даёт ли договор право преподавать: отклонённый и прекращённый — нет. */
export function grantsTeaching(contract: Pick<EdubridgeTeacherContractRecord, 'status'> | null | undefined): boolean {
  return contract?.status === EduContractStatus.ACTIVE || contract?.status === EduContractStatus.PENDING_APPROVAL;
}

/** Отказ пайщикам без договора — один для формы курса и для прямого допуска к курсу. */
export function withoutContractError(teachers: string[]): DomainError {
  return DomainError.badRequest('EDUBRIDGE_COURSE_TEACHERS_WITHOUT_CONTRACT', { teachers: teachers.join(', ') });
}

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
export function coursePeriod(course: Pick<EdubridgeCourseRecord, 'starts_at' | 'lessons_total' | 'lessons_per_month'>): { from: string; to: string } {
  const from = course.starts_at ? String(course.starts_at).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const months = Math.max(1, Math.ceil((course.lessons_total || 0) / Math.max(1, course.lessons_per_month || 1)));
  const start = new Date(`${from}T00:00:00Z`);
  // День прижимается к концу месяца: от 31 января месяц кончается в феврале, а не в марте.
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay) - 1);
  return { from, to: target.toISOString().slice(0, 10) };
}

/** Взносы преподавателя, которые ещё не приняты и не отклонены: их суммы уже обещаны из средств курса. */
const PENDING_CONTRIBUTION_STATUSES = [
  EduContributionStatus.DRAFT,
  EduContributionStatus.HELD,
  EduContributionStatus.SUBMITTED,
  EduContributionStatus.COUNCIL_APPROVED,
  EduContributionStatus.ACT_SIGNED,
];

/**
 * Ставка преподавателя на курсе при назначении: названная администратором
 * либо ставка из договора, но не выше плановой; названная выше плановой — отказ.
 */
export function rateOnCourse(named: string | null | undefined, contractRate: string, plannedRate: string): string {
  const rate = named || rateForCourse(contractRate, plannedRate);
  const error = rateCoverageError(rate, plannedRate);
  if (error) throw error;
  return rate;
}

/** Ставка преподавателя на курсе по умолчанию: из договора, но не выше плановой ставки курса. */
export function rateForCourse(contractRate: string, plannedRate: string): string {
  return rateValue(contractRate) > rateValue(plannedRate) ? plannedRate : contractRate;
}

function rateValue(rate: string | null | undefined): number {
  return Number(String(rate ?? '').trim().split(' ')[0] ?? 0) || 0;
}

/** Ставка ещё не названа. */
const ZERO_RATE = '0.0000 RUB';

/**
 * Ставка закреплена договором: он подписан преподавателем и не прекращён.
 * Отклонённый договор ставку тоже держит — переподписывается он с ней же.
 */
function rateLockedBy(contract: EdubridgeTeacherContractRecord | null): boolean {
  return Boolean(contract) && contract?.status !== EduContractStatus.TERMINATED && isPositiveRate(contract?.hourly_rate);
}

/** Ставка задана, когда сумма больше нуля: «0.0000 RUB» — ещё не названа. */
function isPositiveRate(rate: string | null | undefined): boolean {
  return rateValue(rate) > 0;
}
