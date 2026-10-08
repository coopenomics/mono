import { Inject, Injectable } from '@nestjs/common';
import { EXTENSION_REPOSITORY, type ExtensionDomainRepository, platformSettings, DomainError } from '@coopenomics/extension-kit';
import {
  LEDGER2_HISTORY_PORT,
  PAYMENT_PORT,
  PaymentStatus,
  USER_WALLET_PORT,
  type ILedger2HistoryPort,
  type IPaymentPort,
  type IUserWalletPort,
  type InnerLedger2Operation,
} from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EduAssignmentStatus, EduEnrollmentStatus, EduGroupStatus, EduSettlementEntryKind, EduSettlementEntryStatus } from '../../domain/enums';
import type { EduSettlementEntryDTO } from '../dto/edu-teacher.dto';
import { calculateCourseFee, costOfHours, maxCourseDiscountPercent, type CourseFeeCalculation } from '../../domain/economy/course-fee.calculator';
import type { EdubridgeCourseRecord } from '../../infrastructure/entities';
import { EdubridgeGroupService } from './edubridge-group.service';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeTeacherKyselyRepository } from '../../infrastructure/repositories/edubridge-teacher.kysely-repository';
import { EdubridgeConfigHolder } from '../config/edubridge-config.holder';
import { EdubridgeNamesService } from '../membership/edubridge-names.service';
import type { IConfig } from '../../types';
import type {
  EduCourseEconomyDTO,
  EduCourseEconomyInputDTO,
  EduCourseFeeDTO,
  EduCourseTeacherLoadDTO,
  EduEconomySettingsDTO,
  EduFundMovementDTO,
  EduProgramFundDTO,
  EduProgramWalletDTO,
} from '../dto/edu-economy.dto';
import { t as i18nT } from '../../i18n';

/** Кошельки программы «Образование» в реестре ledger2. */
const FUND_WALLET = 'w.edu.fund';
const MEMBER_WALLET = 'w.edu.member';
const RESERVE_WALLET = 'w.edu.teach';
const ESCROW_WALLET = 'w.edu.escrow';

/** Операции программы, из которых складывается лента движения средств. */
const MOVEMENT_OPERATIONS = ['o.edu.conv', 'o.edu.fee', 'o.edu.lock', 'o.edu.unlock', 'o.edu.allot', 'o.edu.free', 'o.edu.settle', 'o.edu.refund'];

/** Сколько движений показывает лента раздела «Экономика». */
const MOVEMENTS_LIMIT = 50;

/** Базисных пунктов в проценте: скидка хранится целым числом, а показывается процентами. */
const BP_IN_PERCENT = 100;
const MINUTES_IN_HOUR = 60;

/**
 * Экономика программы: целевой членский взнос кооператива, ставки часа преподавателей и
 * расчёт членского взноса за курс. Суммы считает сервер — стол их только
 * показывает, поэтому взнос всегда соответствует часам и ставкам.
 */
@Injectable()
export class EdubridgeEconomyService {
  constructor(
    private readonly config: EdubridgeConfigHolder,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly teachers: EdubridgeTeacherKyselyRepository,
    private readonly names: EdubridgeNamesService,
    @Inject(EXTENSION_REPOSITORY) private readonly extensions: ExtensionDomainRepository<IConfig>,
    @Inject(LEDGER2_HISTORY_PORT) private readonly ledger: ILedger2HistoryPort,
    @Inject(USER_WALLET_PORT) private readonly userWallets: IUserWalletPort,
    @Inject(PAYMENT_PORT) private readonly payments: IPaymentPort,
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly lessons: EdubridgeLessonKyselyRepository,
    private readonly groups: EdubridgeGroupService
  ) {}

  /**
   * Деньги программы: сколько лежит в фонде кооператива, сколько ещё на
   * кошельках учеников, и чем это движение вызвано. Фонд — кооперативный
   * кошелёк, членские взносы учеников — доли пайщиков в общем кошельке
   * программы, поэтому остатки читаются из разных мест.
   */
  async fund(coopname: string): Promise<EduProgramFundDTO> {
    const symbol = platformSettings().blockchain.rootGovernSymbol;
    const [coopWallets, memberShares, history] = await Promise.all([
      this.ledger.getWallets(coopname),
      this.userWallets.findByWallet(coopname, MEMBER_WALLET),
      this.ledger.getHistory({
        coopname,
        actionNames: ['apply'],
        operationCodes: MOVEMENT_OPERATIONS,
        limit: MOVEMENTS_LIMIT,
        sortOrder: 'DESC',
      }),
    ]);

    const fund = coopWallets.find((w) => w.id === FUND_WALLET);
    const reserve = coopWallets.find((w) => w.id === RESERVE_WALLET);
    const escrow = coopWallets.find((w) => w.id === ESCROW_WALLET);
    const fundBalance = fund?.available ?? `0.0000 ${symbol}`;
    const membersMinor = memberShares.reduce((sum, w) => sum + toMinor(w.available ?? '0.0000'), 0);

    const wallets: EduProgramWalletDTO[] = [
      {
        id: FUND_WALLET,
        // Имя из реестра книги учёта называет кошелёк «фондом» — на экране он «кошелёк программы».
        name: i18nT('edubridge.economy.wallet.fund.name'),
        available: fundBalance,
        summary: i18nT('edubridge.economy.wallet.fund.summary'),
        hint: i18nT('edubridge.economy.wallet.fund.hint'),
      },
      {
        id: ESCROW_WALLET,
        name: escrow?.name ?? i18nT('edubridge.economy.wallet.escrow.name'),
        available: escrow?.available ?? `0.0000 ${symbol}`,
        summary: i18nT('edubridge.economy.wallet.escrow.summary'),
        hint: i18nT('edubridge.economy.wallet.escrow.hint'),
      },
      {
        id: RESERVE_WALLET,
        name: reserve?.name ?? i18nT('edubridge.economy.wallet.reserve.name'),
        available: reserve?.available ?? `0.0000 ${symbol}`,
        summary: i18nT('edubridge.economy.wallet.reserve.summary'),
        hint: i18nT('edubridge.economy.wallet.reserve.hint'),
      },
      {
        id: MEMBER_WALLET,
        name: i18nT('edubridge.economy.wallet.members.name'),
        available: formatMinor(membersMinor, symbol),
        summary: i18nT('edubridge.economy.wallet.members.summary'),
        hint: i18nT('edubridge.economy.wallet.members.hint'),
      },
    ];

    return {
      wallets,
      fund_balance: fundBalance,
      members_balance: formatMinor(membersMinor, symbol),
      movements: await this.withNames(history.items.map((op) => toMovement(op, symbol))),
    };
  }

  /**
   * Выписка преподавателя: зачисления на паевой кошелёк программы по принятым
   * результатам (проводка несёт хэш акта — по нему находится взнос) и его
   * возвраты, состояние которых живёт у платежа шлюза. Свежее сверху.
   */
  async settlementJournal(coopname: string, username: string): Promise<EduSettlementEntryDTO[]> {
    const symbol = platformSettings().blockchain.rootGovernSymbol;
    const [history, returns] = await Promise.all([
      this.ledger.getHistory({
        coopname,
        username,
        walletName: PROGRAM_SHARE_WALLET,
        actionNames: ['apply'],
        operationCodes: [SHARE_SETTLE_OPERATION],
        limit: MOVEMENTS_LIMIT,
        sortOrder: 'DESC',
      }),
      this.teachers.listShareReturns(coopname, username),
    ]);
    const incoming = await Promise.all(
      history.items.map(async (op): Promise<EduSettlementEntryDTO> => {
        const contribution = op.processHash ? await this.teachers.findContributionByActHash(coopname, op.processHash) : null;
        return {
          id: op.globalSequence,
          at: op.createdAt,
          kind: EduSettlementEntryKind.IN,
          title: i18nT('edubridge.economy.settlement.accepted'),
          amount: op.quantity ?? `0.0000 ${symbol}`,
          status: EduSettlementEntryStatus.ACCEPTED,
          contribution_id: contribution?.id ?? null,
          return_id: null,
          payment_hash: null,
        };
      })
    );
    const outgoing = await Promise.all(
      returns.map(async (r): Promise<EduSettlementEntryDTO> => {
        const payment = await this.payments.findByHash(r.payment_hash);
        return {
          id: r.id,
          at: r.created_at,
          kind: EduSettlementEntryKind.OUT,
          title: i18nT('edubridge.economy.settlement.return'),
          amount: r.amount,
          status: returnStatus(payment?.status),
          contribution_id: null,
          return_id: r.id,
          payment_hash: r.payment_hash,
        };
      })
    );
    return [...incoming, ...outgoing].sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  /** В ленте пайщик называется по ФИО, логин остаётся для копирования. */
  private async withNames(movements: EduFundMovementDTO[]): Promise<EduFundMovementDTO[]> {
    const usernames = [...new Set(movements.map((m) => m.username).filter((u): u is string => Boolean(u)))];
    const names = await this.names.displayNames(usernames);
    return movements.map((m) => ({ ...m, display_name: m.username ? names.get(m.username) || null : null }));
  }

  async settings(): Promise<EduEconomySettingsDTO> {
    const markup = (await this.config.load()).markup_percent;
    return { markup_percent: markup, max_course_discount_percent: maxCourseDiscountPercent(markup) };
  }

  /** Целевой членский взнос один на кооператив: меняется в разделе «Экономика», действует на все курсы. */
  async setMarkup(markupPercent: number): Promise<EduEconomySettingsDTO> {
    const saved = await this.extensions.patchConfig(EDUBRIDGE_EXTENSION_NAME, { markup_percent: markupPercent });
    this.config.set(saved.config);
    return { markup_percent: markupPercent, max_course_discount_percent: maxCourseDiscountPercent(markupPercent) };
  }

  /**
   * Ставку часа в договоре правит администратор. Она — ставка по умолчанию
   * для новых допусков к курсам; у действующих допусков ставка своя и от
   * договорной не меняется (`setAssignmentRate`).
   */
  async setTeacherRate(coopname: string, username: string, hourlyRate: string): Promise<string> {
    const contract = await this.teachers.findContract(coopname, username);
    if (!contract) throw DomainError.notFound('EDUBRIDGE_TEACHER_CONTRACT_NOT_FOUND');
    contract.hourly_rate = hourlyRate;
    await this.teachers.saveContract(contract);
    return hourlyRate;
  }

  /** Расчёт по параметрам формы — стол показывает суммы до сохранения курса. */
  async preview(input: EduCourseEconomyInputDTO): Promise<EduCourseFeeDTO> {
    const markup = (await this.config.load()).markup_percent;
    return this.toFeeDTO(this.calculate(input, markup), markup);
  }

  /**
   * Взнос курса при сохранении. Скидка за взнос разом ограничена наценкой: взнос
   * за курс не опускается ниже себестоимости — иначе кооператив взял бы на себя
   * обязательства перед преподавателями, которых собранный взнос не покрывает.
   */
  async feeForCourse(input: EduCourseEconomyInputDTO): Promise<{ fee_month: string }> {
    const markup = (await this.config.load()).markup_percent;
    const calc = this.calculate(input, markup);
    if (!input.course_payment_enabled) return { fee_month: calc.fee_month };
    if (calc.course_months === 0) {
      throw DomainError.badRequest('EDUBRIDGE_COURSE_LESSONS_TOTAL_REQUIRED');
    }
    const limit = maxCourseDiscountPercent(markup);
    const discount = input.course_discount_percent ?? 0;
    if (discount > limit) {
      throw DomainError.badRequest('EDUBRIDGE_COURSE_DISCOUNT_TOO_HIGH', { discount, markup, limit });
    }
    return { fee_month: calc.fee_month };
  }

  /**
   * План и факт курса: плановый расчёт против ставок назначенных преподавателей.
   * Пока обязательства укладываются во взнос, курс считается обеспеченным.
   */
  async courseEconomy(coopname: string, courseId: string, groupId?: string | null): Promise<EduCourseEconomyDTO> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');

    const markup = (await this.config.load()).markup_percent;
    const plan = this.calculate(this.paramsOf(course), markup);

    const assignments = (await this.teachers.listAssignments(coopname)).filter(
      (a) => a.course_id === courseId && a.status === EduAssignmentStatus.ACTIVE
    );
    const contracts = await this.teachers.listContracts(coopname);
    const rates = new Map(contracts.map((c) => [c.teacher_username, c.hourly_rate]));
    const displayNames = await this.names.displayNames(assignments.map((a) => a.teacher_username));

    // Занятие оплачивается один раз, кто бы из преподавателей его ни провёл, и
    // заранее неизвестно, кто какое проведёт. Прогноз на месяц — занятия курса
    // по наибольшей ставке среди его преподавателей: верхняя граница, нагрузку
    // между ними распределять не нужно. В строке преподавателя — занятия курса
    // по его ставке.
    const hours = plan.hours_per_month;
    const teachers: EduCourseTeacherLoadDTO[] = assignments.map((a) => {
      // Ставка преподавателя на этом курсе; у прежних допусков без неё — по договору.
      const rate = toMinor(a.hourly_rate ?? '') > 0 ? a.hourly_rate : rates.get(a.teacher_username) ?? '0.0000 RUB';
      return {
        username: a.teacher_username,
        display_name: displayNames.get(a.teacher_username) ?? '',
        hourly_rate: rate,
        hours_per_month: hours,
        cost_month: costOfHours(rate, hours),
      };
    });

    const actualMinor = teachers.reduce((max, t) => Math.max(max, toMinor(t.cost_month)), 0);
    const symbol = symbolOf(plan.fee_month);

    return {
      plan: this.toFeeDTO(plan, markup),
      teachers,
      actual_cost_month: formatMinor(actualMinor, symbol),
      actual_hours_per_month: teachers.length ? hours : 0,
      over_fee: actualMinor > toMinor(plan.fee_month),
      // По группам взнос преподавателей показывается по плановой ставке курса — она и есть предел ставки преподавателя.
      ...(await this.groupEconomy(coopname, course, groupId, toMinor(plan.cost_month), symbol)),
    };
  }

  /**
   * Месяц при нынешнем числе обучающихся — для показа администратору. Группа
   * названа — считается она; не названа — сумма по всем идущим группам курса.
   * Взносы — месячный взнос группы за каждого обучающегося с оплаченным
   * доступом. Взнос преподавателей — по способу расчёта группы: за каждого
   * обучающегося либо один на занятие. Суммы занятий считает контракт; здесь
   * план месяца по тем же условиям.
   */
  private async groupEconomy(coopname: string, course: EdubridgeCourseRecord, groupId: string | null | undefined, teachersMinor: number, symbol: string) {
    const all = await this.groups.list(coopname, course.id);
    const named = groupId ? all.find((g) => g.id === groupId) ?? null : null;
    const scope = named ? [named] : all.filter((g) => g.status === EduGroupStatus.ACTIVE);
    const now = new Date();
    const total = { learners: 0, fees: 0, teachers: 0, locked: false, started: false };
    for (const group of scope) {
      const terms = this.groups.viewOf(course, group);
      const enrollments = await this.enrollments.findByGroup(coopname, group.id);
      const learners = enrollments.filter((e) => hasPaidAccess(e, now)).length;
      total.learners += learners;
      total.fees += toMinor(terms.fee_month) * learners;
      total.teachers += teachersOfMonth(Boolean(terms.pay_per_learner), learners, teachersMinor);
      total.locked = total.locked || enrollments.length > 0;
      total.started = total.started || (await this.lessons.findByGroup(coopname, group.id)).length > 0;
    }
    return {
      group_id: named?.id ?? null,
      pay_per_learner: Boolean(named ? named.pay_per_learner : course.pay_per_learner),
      learners_active: total.learners,
      group_fee_month: formatMinor(total.fees, symbol),
      group_teachers_month: formatMinor(total.teachers, symbol),
      group_program_month: formatMinor(Math.max(0, total.fees - total.teachers), symbol),
      terms_locked: total.locked,
      start_locked: total.started,
    };
  }

  /** Параметры курса в виде, понятном расчёту. */
  paramsOf(course: EdubridgeCourseRecord): EduCourseEconomyInputDTO {
    return {
      lessons_per_month: course.lessons_per_month,
      lessons_total: course.lessons_total,
      lesson_minutes: course.lesson_minutes,
      planned_hourly_rate: course.planned_hourly_rate,
      course_payment_enabled: course.course_payment_enabled,
      course_discount_percent: course.course_discount_bp / BP_IN_PERCENT,
    };
  }

  private calculate(input: EduCourseEconomyInputDTO, markupPercent: number): CourseFeeCalculation {
    return calculateCourseFee({
      lessons_per_month: input.lessons_per_month,
      lesson_hours: input.lesson_minutes / MINUTES_IN_HOUR,
      hourly_rate: input.planned_hourly_rate,
      markup_percent: markupPercent,
      lessons_total: input.lessons_total,
      // Скидка действует, только когда кооператив принимает взнос разом.
      course_discount_percent: input.course_payment_enabled ? (input.course_discount_percent ?? 0) : 0,
    });
  }

  private toFeeDTO(calc: CourseFeeCalculation, markupPercent: number): EduCourseFeeDTO {
    return { ...calc, markup_percent: markupPercent };
  }
}

/** Подписи движений — языком выписки, без кодов операций. */
const MOVEMENT_TITLES: Record<string, { title: string; direction: string }> = {
  'o.edu.conv': { title: i18nT('edubridge.economy.movement.conv'), direction: 'in' },
  'o.edu.fee': { title: i18nT('edubridge.economy.movement.fee'), direction: 'in' },
  'o.edu.lock': { title: i18nT('edubridge.economy.movement.lock'), direction: 'out' },
  'o.edu.unlock': { title: i18nT('edubridge.economy.movement.unlock'), direction: 'in' },
  'o.edu.allot': { title: i18nT('edubridge.economy.movement.allot'), direction: 'out' },
  'o.edu.free': { title: i18nT('edubridge.economy.movement.free'), direction: 'in' },
  'o.edu.settle': { title: i18nT('edubridge.economy.movement.settle'), direction: 'out' },
  'o.edu.refund': { title: i18nT('edubridge.economy.movement.refund'), direction: 'out' },
};

/** Паевой взнос преподавателя по программе — кошелёк, по которому строится его выписка. */
const PROGRAM_SHARE_WALLET = 'w.edu.share';
/** Зачисление паевого взноса по принятому результату. */
const SHARE_SETTLE_OPERATION = 'o.edu.ridshr';

/**
 * Состояние возврата — по платежу шлюза: ждёт решения совета, одобрен и ждёт
 * кассира, выплачен, либо не состоялся. Платежа нет — возврат не состоялся.
 */
function returnStatus(status: PaymentStatus | undefined): EduSettlementEntryStatus {
  switch (status) {
    case PaymentStatus.AWAITING_AUTHORIZATION:
      return EduSettlementEntryStatus.COUNCIL_REVIEW;
    case PaymentStatus.PENDING:
    case PaymentStatus.PROCESSING:
      return EduSettlementEntryStatus.AWAITING_PAYOUT;
    case PaymentStatus.PAID:
    case PaymentStatus.COMPLETED:
      return EduSettlementEntryStatus.PAID;
    default:
      return EduSettlementEntryStatus.DECLINED;
  }
}

function toMovement(op: InnerLedger2Operation, symbol: string): EduFundMovementDTO {
  const known = MOVEMENT_TITLES[op.operationCode ?? ''] ?? { title: op.memo ?? i18nT('edubridge.economy.movement.fallback'), direction: 'in' };
  return {
    id: op.globalSequence,
    at: op.createdAt,
    title: known.title,
    amount: op.quantity ?? `0.0000 ${symbol}`,
    username: op.username ?? null,
    display_name: null,
    direction: known.direction,
  };
}

function symbolOf(asset: string): string {
  return asset.trim().split(' ')[1] ?? '';
}

function toMinor(asset: string): number {
  const [amount] = asset.trim().split(' ');
  return Math.round(Number(amount) * 10_000);
}

function formatMinor(minor: number, symbol: string): string {
  return `${(minor / 10_000).toFixed(4)} ${symbol}`;
}

/** Подписка действует, и доступ по ней оплачен на этот момент. */
function hasPaidAccess(e: { status: EduEnrollmentStatus; paid_until: Date | null }, now: Date): boolean {
  return e.status === EduEnrollmentStatus.ACTIVE && Boolean(e.paid_until) && new Date(e.paid_until as Date) > now;
}

/** Взнос преподавателей группы за месяц: за каждого обучающегося либо один на занятие; без обучающихся занятий нет. */
function teachersOfMonth(perLearner: boolean, learners: number, teachersMinor: number): number {
  if (learners === 0) return 0;
  return perLearner ? teachersMinor * learners : teachersMinor;
}
