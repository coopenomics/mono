import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsNumber, IsString, Length, Matches, Max, Min } from 'class-validator';

/** Сумма в формате цепи: «1000.0000 RUB». */
const ASSET_PATTERN = /^\d+\.\d{4} [A-Z]{1,7}$/;

/** Настройки экономики программы — одни на кооператив. */
@ObjectType('EduEconomySettings')
export class EduEconomySettingsDTO {
  @Field(() => Float, { description: 'Наценка кооператива к себестоимости курса, проценты' })
  markup_percent!: number;

  @Field(() => Float, { description: 'Предельная скидка за годовой объём при этой наценке, проценты' })
  max_year_discount_percent!: number;
}

@InputType('EduSetEconomySettingsInput')
export class EduSetEconomySettingsInputDTO {
  @Field(() => Float, { description: 'Наценка кооператива к себестоимости курса, проценты' })
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
  @Matches(ASSET_PATTERN, { message: 'Ставка должна быть в формате «1000.0000 RUB»' })
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
  @Matches(ASSET_PATTERN, { message: 'Ставка должна быть в формате «1000.0000 RUB»' })
  planned_hourly_rate!: string;

  @Field(() => Float, { description: 'Скидка за годовой объём, проценты' })
  @IsNumber()
  @Min(0)
  @Max(100)
  year_discount_percent!: number;
}

/** Расчёт взноса: себестоимость, наценка, месяц и год. */
@ObjectType('EduCourseFee')
export class EduCourseFeeDTO {
  @Field(() => Float, { description: 'Часов занятий в месяц' })
  hours_per_month!: number;

  @Field(() => String, { description: 'Себестоимость месяца — часы по ставке' })
  cost_month!: string;

  @Field(() => String, { description: 'Наценка кооператива в сумме за месяц' })
  markup_month!: string;

  @Field(() => String, { description: 'Членский взнос за месяц' })
  fee_month!: string;

  @Field(() => String, { description: 'Взнос за год до скидки' })
  fee_year_base!: string;

  @Field(() => String, { description: 'Скидка за годовой объём в сумме' })
  year_discount_amount!: string;

  @Field(() => String, { description: 'Членский взнос за год' })
  fee_year!: string;

  @Field(() => String, { description: 'Себестоимость года' })
  cost_year!: string;

  @Field(() => Float, { description: 'Предельная скидка при текущей наценке, проценты' })
  max_year_discount_percent!: number;

  @Field(() => Float, { description: 'Наценка кооператива, проценты' })
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
