import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EXTENSION_REPOSITORY, type ExtensionDomainRepository } from '@coopenomics/extension-kit';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EduAssignmentStatus } from '../../domain/enums';
import { calculateCourseFee, costOfHours, maxYearDiscountPercent, type CourseFeeCalculation } from '../../domain/economy/course-fee.calculator';
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
} from '../dto/edu-economy.dto';

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
    @Inject(EXTENSION_REPOSITORY) private readonly extensions: ExtensionDomainRepository<IConfig>
  ) {}

  async settings(): Promise<EduEconomySettingsDTO> {
    const markup = (await this.config.load()).markup_percent;
    return { markup_percent: markup, max_year_discount_percent: maxYearDiscountPercent(markup) };
  }

  /** Наценка одна на кооператив: меняется в разделе «Экономика», действует на все курсы. */
  async setMarkup(markupPercent: number): Promise<EduEconomySettingsDTO> {
    const saved = await this.extensions.patchConfig(EDUBRIDGE_EXTENSION_NAME, { markup_percent: markupPercent });
    this.config.set(saved.config);
    return { markup_percent: markupPercent, max_year_discount_percent: maxYearDiscountPercent(markupPercent) };
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
   * Взнос курса при сохранении. Скидка за год ограничена наценкой: годовой взнос
   * не опускается ниже себестоимости — иначе кооператив взял бы на себя обязательства
   * перед преподавателями, которых собранный взнос не покрывает.
   */
  async feeForCourse(input: EduCourseEconomyInputDTO): Promise<{ fee_month: string; fee_year: string }> {
    const markup = (await this.config.load()).markup_percent;
    const calc = this.calculate(input, markup);
    const limit = maxYearDiscountPercent(markup);
    if (input.year_discount_percent > limit) {
      throw new BadRequestException(
        `Скидка ${input.year_discount_percent}% больше наценки кооператива: при наценке ${markup}% годовой взнос опустится ниже себестоимости. Предельная скидка — ${limit}%`
      );
    }
    return { fee_month: calc.fee_month, fee_year: calc.fee_year };
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
      year_discount_percent: course.year_discount_bp / BP_IN_PERCENT,
    };
  }

  private calculate(input: EduCourseEconomyInputDTO, markupPercent: number): CourseFeeCalculation {
    return calculateCourseFee({
      lessons_per_month: input.lessons_per_month,
      lesson_hours: input.lesson_minutes / MINUTES_IN_HOUR,
      hourly_rate: input.planned_hourly_rate,
      markup_percent: markupPercent,
      year_discount_percent: input.year_discount_percent,
    });
  }

  private toFeeDTO(calc: CourseFeeCalculation, markupPercent: number): EduCourseFeeDTO {
    return { ...calc, markup_percent: markupPercent };
  }
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
