import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EXTENSION_REPOSITORY, type ExtensionDomainRepository, platformSettings } from '@coopenomics/extension-kit';
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

/** Кошельки программы «Образование» в реестре ledger2. */
const FUND_WALLET = 'w.edu.fund';
const MEMBER_WALLET = 'w.edu.member';
const RESERVE_WALLET = 'w.edu.teach';

/** Операции программы, из которых складывается лента движения средств. */
const MOVEMENT_OPERATIONS = ['o.edu.conv', 'o.edu.fee', 'o.edu.allot', 'o.edu.free', 'o.edu.settle', 'o.edu.refund'];

/** Сколько движений показывает лента раздела «Экономика». */
const MOVEMENTS_LIMIT = 50;

/** Базисных пунктов в проценте: скидка хранится целым числом, а показывается процентами. */
const BP_IN_PERCENT = 100;
const MINUTES_IN_HOUR = 60;

/**
 * Экономика программы: наценка кооператива, ставки часа преподавателей и
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
    const fundBalance = fund?.available ?? `0.0000 ${symbol}`;
    const membersMinor = memberShares.reduce((sum, w) => sum + toMinor(w.available ?? '0.0000'), 0);

    const wallets: EduProgramWalletDTO[] = [
      {
        id: FUND_WALLET,
        name: fund?.name ?? 'Фонд ЦПП «Образование»',
        available: fundBalance,
        hint: 'Свободные средства программы: из них идут расходы и возвраты по Положению. Обещанное преподавателям сюда не входит.',
      },
      {
        id: RESERVE_WALLET,
        name: reserve?.name ?? 'Резерв выплат преподавателям',
        available: reserve?.available ?? `0.0000 ${symbol}`,
        hint: 'Себестоимость оплаченных занятий: выделяется из каждого взноса и уменьшается, когда результат преподавателя принят. На расходы программы не идёт.',
      },
      {
        id: MEMBER_WALLET,
        name: 'Членские взносы учеников',
        available: formatMinor(membersMinor, symbol),
        hint: 'Внесено учениками, но ещё не списано в фонд: остаток появляется при возврате и до подключения подписки.',
      },
    ];

    return {
      wallets,
      fund_balance: fundBalance,
      members_balance: formatMinor(membersMinor, symbol),
      movements: history.items.map((op) => toMovement(op, symbol)),
    };
  }

  async settings(): Promise<EduEconomySettingsDTO> {
    const markup = (await this.config.load()).markup_percent;
    return { markup_percent: markup, max_course_discount_percent: maxCourseDiscountPercent(markup) };
  }

  /** Наценка одна на кооператив: меняется в разделе «Экономика», действует на все курсы. */
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
    if (!contract) throw new NotFoundException('У преподавателя нет договора участия в хозяйственной деятельности');
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
      throw new BadRequestException('Взнос за весь курс считается от программы — укажите, сколько в ней занятий');
    }
    const limit = maxCourseDiscountPercent(markup);
    const discount = input.course_discount_percent ?? 0;
    if (discount > limit) {
      throw new BadRequestException(
        `Скидка ${discount}% больше наценки кооператива: при наценке ${markup}% взнос за курс опустится ниже себестоимости. Предельная скидка — ${limit}%`
      );
    }
    return { fee_month: calc.fee_month };
  }

  /**
   * План и факт курса: плановый расчёт против ставок назначенных преподавателей.
   * Пока обязательства укладываются во взнос, курс считается обеспеченным.
   */
  async courseEconomy(coopname: string, courseId: string): Promise<EduCourseEconomyDTO> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) throw new NotFoundException('Курс не найден');

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
  'o.edu.conv': { title: 'Ученик внёс членский взнос', direction: 'in' },
  'o.edu.fee': { title: 'Взнос за курс списан в фонд программы', direction: 'in' },
  'o.edu.allot': { title: 'Себестоимость взноса выделена в резерв выплат преподавателям', direction: 'out' },
  'o.edu.free': { title: 'Резерв высвобожден в фонд: подписка отменена', direction: 'in' },
  'o.edu.settle': { title: 'Расчёт с преподавателем за счёт резерва', direction: 'out' },
  'o.edu.refund': { title: 'Взнос возвращён ученику', direction: 'out' },
};

function toMovement(op: InnerLedger2Operation, symbol: string): EduFundMovementDTO {
  const known = MOVEMENT_TITLES[op.operationCode ?? ''] ?? { title: op.memo ?? 'Движение средств', direction: 'in' };
  return {
    id: op.globalSequence,
    at: op.createdAt,
    title: known.title,
    amount: op.quantity ?? `0.0000 ${symbol}`,
    username: op.username ?? null,
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
