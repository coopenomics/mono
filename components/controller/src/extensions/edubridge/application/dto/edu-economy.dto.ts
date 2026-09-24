import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { validationMessage } from '@coopenomics/extension-kit';

/** Сумма в формате цепи: «1000.0000 RUB». */
const ASSET_PATTERN = /^\d+\.\d{4} [A-Z]{1,7}$/;

/** Настройки экономики программы — одни на кооператив. */
@ObjectType('EduEconomySettings')
export class EduEconomySettingsDTO {
  @Field(() => Float, { description: 'Целевой членский взнос кооператива сверх себестоимости курса, проценты' })
  markup_percent!: number;

  @Field(() => Float, { description: 'Предельная скидка за взнос разом за весь курс при этом целевом членском взносе, проценты' })
  max_course_discount_percent!: number;
}

@InputType('EduSetEconomySettingsInput')
export class EduSetEconomySettingsInputDTO {
  @Field(() => Float, { description: 'Целевой членский взнос кооператива сверх себестоимости курса, проценты' })
  @IsNumber()
  @Min(0)
  @Max(500)
  markup_percent!: number;
}

@InputType('EduSetTeacherRateInput')
export class EduSetTeacherRateInputDTO {
  @Field(() => String, { description: 'Преподаватель (учётное имя)' })
  @IsString()
  @Length(1, 13)
  username!: string;

  @Field(() => String, { description: 'Ставка часа («1000.0000 RUB»)' })
  @Matches(ASSET_PATTERN, { message: validationMessage('edubridge.eduSetTeacherRateInput.hourlyRate.format') })
  hourly_rate!: string;
}

/** Параметры, из которых складывается взнос за курс. */
@InputType('EduCourseEconomyInput')
export class EduCourseEconomyInputDTO {
  @Field(() => Int, { description: 'Занятий в месяц по расписанию' })
  @IsInt()
  @Min(1)
  @Max(62)
  lessons_per_month!: number;

  @Field(() => Int, { description: 'Занятий во всей программе курса' })
  @IsInt()
  @Min(1)
  @Max(2000)
  lessons_total!: number;

  @Field(() => Int, { description: 'Длительность занятия, минут' })
  @IsInt()
  @Min(5)
  @Max(480)
  lesson_minutes!: number;

  @Field(() => String, { description: 'Плановая ставка часа по программе («1000.0000 RUB»)' })
  @Matches(ASSET_PATTERN, { message: validationMessage('edubridge.eduCourseEconomyInput.plannedHourlyRate.format') })
  planned_hourly_rate!: string;

  @Field(() => Boolean, { nullable: true, description: 'Принимать взнос за весь курс разом; иначе взнос только помесячный' })
  @IsOptional()
  @IsBoolean()
  course_payment_enabled?: boolean;

  @Field(() => Float, { nullable: true, description: 'Скидка за взнос разом за весь курс, проценты' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  course_discount_percent?: number;
}

/** Расчёт взноса: себестоимость, целевой членский взнос, взнос за месяц и за весь курс разом. */
@ObjectType('EduCourseFee')
export class EduCourseFeeDTO {
  @Field(() => Float, { description: 'Часов занятий в месяц' })
  hours_per_month!: number;

  @Field(() => String, { description: 'Себестоимость месяца — часы по ставке' })
  cost_month!: string;

  @Field(() => String, { description: 'Целевой членский взнос кооператива в сумме за месяц' })
  markup_month!: string;

  @Field(() => String, { description: 'Членский взнос за месяц' })
  fee_month!: string;

  @Field(() => Int, { description: 'Длительность курса в месяцах; ноль — у курса нет конечной программы' })
  course_months!: number;

  @Field(() => String, { description: 'Сумма помесячных взносов за весь курс' })
  fee_course_base!: string;

  @Field(() => String, { description: 'Скидка за взнос разом в сумме' })
  course_discount_amount!: string;

  @Field(() => String, { description: 'Членский взнос за весь курс разом' })
  fee_course!: string;

  @Field(() => String, { description: 'Себестоимость курса' })
  cost_course!: string;

  @Field(() => Float, { description: 'Предельная скидка при текущем целевом членском взносе, проценты' })
  max_course_discount_percent!: number;

  @Field(() => Float, { description: 'Целевой членский взнос кооператива, проценты' })
  markup_percent!: number;
}

/** Нагрузка преподавателя на курсе и её стоимость по его ставке. */
@ObjectType('EduCourseTeacherLoad')
export class EduCourseTeacherLoadDTO {
  @Field(() => String, { description: 'Учётное имя' })
  username!: string;

  @Field(() => String, { description: 'Фамилия, имя и отчество' })
  display_name!: string;

  @Field(() => String, { description: 'Ставка часа преподавателя' })
  hourly_rate!: string;

  @Field(() => Float, { description: 'Нагрузка, часов в месяц' })
  hours_per_month!: number;

  @Field(() => String, { description: 'Стоимость нагрузки за месяц' })
  cost_month!: string;
}

/** Экономика курса: плановый расчёт и факт по назначенным преподавателям. */
@ObjectType('EduCourseEconomy')
export class EduCourseEconomyDTO {
  @Field(() => EduCourseFeeDTO, { description: 'Плановый расчёт взноса' })
  plan!: EduCourseFeeDTO;

  @Field(() => [EduCourseTeacherLoadDTO], { description: 'Нагрузка назначенных преподавателей' })
  teachers!: EduCourseTeacherLoadDTO[];

  @Field(() => String, { description: 'Себестоимость месяца по ставкам назначенных преподавателей' })
  actual_cost_month!: string;

  @Field(() => Float, { description: 'Часов в месяц, распределённых между преподавателями' })
  actual_hours_per_month!: number;

  @Field(() => Boolean, { description: 'Обязательства перед преподавателями превысили собранный взнос' })
  over_fee!: boolean;
}

@InputType('EduSetAssignmentLoadInput')
export class EduSetAssignmentLoadInputDTO {
  @Field(() => String, { description: 'Назначение' })
  @IsString()
  assignment_id!: string;

  @Field(() => Int, { description: 'Нагрузка преподавателя по курсу, минут в месяц' })
  @IsInt()
  @Min(0)
  @Max(20_000)
  minutes_per_month!: number;
}

/** Кошелёк программы с остатком. */
@ObjectType('EduProgramWallet')
export class EduProgramWalletDTO {
  @Field(() => String, { description: 'Идентификатор кошелька' })
  id!: string;

  @Field(() => String, { description: 'Название кошелька' })
  name!: string;

  @Field(() => String, { description: 'Остаток' })
  available!: string;

  @Field(() => String, { description: 'Короткая подпись: что это за средства' })
  summary!: string;

  @Field(() => String, { description: 'Подробно: откуда средства берутся, куда уходят и на что их можно тратить' })
  hint!: string;
}

/** Движение средств программы — одна строка ленты. */
@ObjectType('EduFundMovement')
export class EduFundMovementDTO {
  @Field(() => String, { description: 'Номер движения' })
  id!: string;

  @Field(() => Date, { description: 'Когда' })
  at!: Date;

  @Field(() => String, { description: 'Что произошло' })
  title!: string;

  @Field(() => String, { description: 'Сумма' })
  amount!: string;

  @Field(() => String, { nullable: true, description: 'Пайщик, к которому относится движение' })
  username!: string | null;

  @Field(() => String, { nullable: true, description: 'ФИО пайщика (у организации — наименование)' })
  display_name!: string | null;

  @Field(() => String, { description: 'Направление: приход в фонд или расход из него' })
  direction!: string;
}

/** Деньги программы: кошельки и лента движения. */
@ObjectType('EduProgramFund')
export class EduProgramFundDTO {
  @Field(() => [EduProgramWalletDTO], { description: 'Кошельки программы с остатками' })
  wallets!: EduProgramWalletDTO[];

  @Field(() => String, { description: 'Остаток фонда программы' })
  fund_balance!: string;

  @Field(() => String, { description: 'Членские взносы на кошельках учеников — ещё не списаны в фонд' })
  members_balance!: string;

  @Field(() => [EduFundMovementDTO], { description: 'Последние движения средств программы' })
  movements!: EduFundMovementDTO[];
}
