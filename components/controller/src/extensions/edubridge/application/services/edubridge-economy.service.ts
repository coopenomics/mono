import { Inject, Injectable } from '@nestjs/common';
import { EXTENSION_REPOSITORY, type ExtensionDomainRepository, platformSettings, DomainError } from '@coopenomics/extension-kit';
import {
  LEDGER2_HISTORY_PORT,
  USER_WALLET_PORT,
  type ILedger2HistoryPort,
  type IUserWalletPort,
  type InnerLedger2Operation,
} from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EduAssignmentStatus } from '../../domain/enums';
import { calculateCourseFee, costOfHours, maxCourseDiscountPercent, type CourseFeeCalculation } from '../../domain/economy/course-fee.calculator';
import type { EdubridgeCourseEntity } from '../../infrastructure/entities';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeTeacherRepository } from '../../infrastructure/repositories/edubridge-teacher.repository';
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
    private readonly courses: EdubridgeCourseRepository,
    private readonly teachers: EdubridgeTeacherRepository,
    private readonly names: EdubridgeNamesService,
    @Inject(EXTENSION_REPOSITORY) private readonly extensions: ExtensionDomainRepository<IConfig>,
    @Inject(LEDGER2_HISTORY_PORT) private readonly ledger: ILedger2HistoryPort,
    @Inject(USER_WALLET_PORT) private readonly userWallets: IUserWalletPort
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
        name: fund?.name ?? i18nT('edubridge.economy.wallet.fund.name'),
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
   * Ставку часа правит администратор: от неё зависит и себестоимость курса, и
   * взнос преподавателя за проведённое занятие, поэтому менять её в одиночку
   * преподаватель не может.
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
  async courseEconomy(coopname: string, courseId: string): Promise<EduCourseEconomyDTO> {
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

    const teachers: EduCourseTeacherLoadDTO[] = assignments.map((a) => {
      const rate = rates.get(a.teacher_username) ?? '0.0000 RUB';
      const hours = a.minutes_per_month / MINUTES_IN_HOUR;
      return {
        username: a.teacher_username,
        display_name: displayNames.get(a.teacher_username) ?? '',
        hourly_rate: rate,
        hours_per_month: round2(hours),
        cost_month: costOfHours(rate, hours),
      };
    });

    const actualMinor = teachers.reduce((sum, t) => sum + toMinor(t.cost_month), 0);
    const symbol = symbolOf(plan.fee_month);

    return {
      plan: this.toFeeDTO(plan, markup),
      teachers,
      actual_cost_month: formatMinor(actualMinor, symbol),
      actual_hours_per_month: round2(teachers.reduce((sum, t) => sum + t.hours_per_month, 0)),
      over_fee: actualMinor > toMinor(plan.fee_month),
    };
  }

  /** Параметры курса в виде, понятном расчёту. */
  paramsOf(course: EdubridgeCourseEntity): EduCourseEconomyInputDTO {
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
