import { Field, ID, InputType, Int, ObjectType, Float } from '@nestjs/graphql';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { EduGroupStatus } from '../../domain/enums';
import type { EdubridgeGroupRecord } from '../../infrastructure/entities';
import { exactLessonsPerMonth, formatSlots, round2 } from '../../domain/lib/schedule';
import { EduScheduleSlotDTO } from './edu-schedule.dto';

/** Группа (набор) курса: свои дата начала, условия, участники, занятия и учёт средств. */
@ObjectType('EduGroup')
export class EduGroupDTO {
  @Field(() => ID) id!: string;
  @Field(() => ID, { description: 'Курс' }) course_id!: string;
  @Field(() => String, { description: 'Название группы' }) title!: string;
  @Field(() => EduGroupStatus, { description: 'Состояние группы' }) status!: EduGroupStatus;
  @Field(() => Boolean, { description: 'Набор в группу открыт' }) enrollment_open!: boolean;
  @Field(() => String, { description: 'Привязка к площадке: курс и, если есть, группа площадки' }) external_ref!: string;
  @Field(() => String, { nullable: true, description: 'Дата начала занятий группы' }) starts_at!: string | null;
  @Field(() => Date, { nullable: true, description: 'Момент начала занятий с точностью до минуты — назван на стенде разработки со сжатым временем' }) starts_at_time!: Date | null;
  @Field(() => String, { description: 'Членский взнос за месяц в группе' }) fee_month!: string;
  @Field(() => String, { description: 'Плановая ставка часа в группе' }) planned_hourly_rate!: string;
  @Field(() => Boolean, { description: 'Взнос преподавателя за занятие считается за каждого участника; иначе фиксированный за занятие' }) pay_per_learner!: boolean;
  @Field(() => Float, { description: 'Занятий в программе группы — для показа' }) lessons_total!: number;
  @Field(() => Int, { description: 'Гарантийный срок, дней' }) guarantee_days!: number;
  @Field(() => [EduScheduleSlotDTO], { description: 'Окна расписания группы' }) schedule_slots!: EduScheduleSlotDTO[];
  @Field(() => String, { description: 'Расписание группы строкой, собрано из окон' }) schedule!: string;
  @Field(() => Int, { description: 'Срок на отчёт преподавателя о занятии, дней после занятия' }) report_days!: number;
  @Field(() => Float, { description: 'Занятий в месяц по окнам расписания: окон недели на четыре — для показа' }) lessons_per_month!: number;
  @Field(() => Int, { description: 'Длительность занятия по первому окну, минут' }) lesson_minutes!: number;
  @Field(() => Int, { description: 'Длительность программы, месяцев; ноль — программа без конца' }) program_months!: number;
  @Field(() => Int, { description: 'Минут занятий в месяц — по ним контракт считает взнос' }) minutes_per_month!: number;
  @Field(() => Int, { description: 'Минут занятий в программе; ноль — программа без конца' }) minutes_total!: number;
  @Field(() => String, { nullable: true, description: 'Остаток резерва преподавателям по группе' }) teacher_reserve_balance!: string | null;
  @Field(() => String, { nullable: true, description: 'Выплачено преподавателям по группе' }) teacher_settled_total!: string | null;
  @Field(() => Int, { description: 'Участников с действующей подпиской' }) learners_active!: number;
  @Field(() => Int, { description: 'Проведено занятий' }) lessons_held!: number;
  @Field(() => Int, { description: 'Подписок с вышедшим оплаченным сроком, расчёты по которым ещё открыты' }) settlement_pending!: number;
  @Field(() => Date) created_at!: Date;

  constructor(e: EdubridgeGroupRecord, counts: { learners_active: number; lessons_held: number; settlement_pending?: number } = { learners_active: 0, lessons_held: 0 }) {
    Object.assign(this, {
      id: e.id,
      course_id: e.course_id,
      title: e.title,
      status: e.status,
      enrollment_open: e.enrollment_open,
      external_ref: e.external_ref ?? '',
      starts_at: e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 10) : null,
      starts_at_time: e.starts_at_time ?? null,
      fee_month: e.fee_month,
      planned_hourly_rate: e.planned_hourly_rate,
      pay_per_learner: Boolean(e.pay_per_learner),
      lessons_total: round2(exactLessonsPerMonth(e.schedule_slots ?? []) * (e.program_months ?? 0)),
      guarantee_days: e.guarantee_days,
      schedule_slots: (e.schedule_slots ?? []).map((s) => new EduScheduleSlotDTO(s)),
      schedule: formatSlots(e.schedule_slots ?? []),
      report_days: e.report_days ?? 7,
      lessons_per_month: exactLessonsPerMonth(e.schedule_slots ?? []),
      lesson_minutes: e.lesson_minutes,
      program_months: e.program_months ?? 0,
      minutes_per_month: e.minutes_per_month ?? 0,
      minutes_total: e.minutes_total ?? 0,
      teacher_reserve_balance: e.teacher_reserve_balance,
      teacher_settled_total: e.teacher_settled_total,
      created_at: e.created_at,
      settlement_pending: 0,
      ...counts,
    });
  }
}

/** Новая группа курса: условия берутся с курса на день открытия. */
@InputType('EduCreateGroupInput')
export class EduCreateGroupInputDTO {
  @Field(() => ID, { description: 'Курс' })
  @IsUUID()
  course_id!: string;

  @Field(() => String, { nullable: true, description: 'Название группы; не названа — «Группа N»' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  title?: string | null;

  @Field(() => String, { nullable: true, description: 'Дата начала занятий (YYYY-MM-DD); пусто — ещё не назначена' })
  @IsOptional()
  @IsDateString()
  starts_at?: string | null;

  @Field(() => Int, { nullable: true, description: 'Начало занятий через столько минут — только на стенде разработки со сжатым временем' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  starts_in_minutes?: number | null;

  @Field(() => String, { nullable: true, description: 'Привязка к площадке: курс и, если есть, группа площадки; пусто — как у курса' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  external_ref?: string | null;
}

/** Правка группы: название, привязка к площадке, набор и дата начала. Денежные условия группы не меняются. */
@InputType('EduUpdateGroupInput')
export class EduUpdateGroupInputDTO {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  title?: string | null;

  @Field(() => String, { nullable: true, description: 'Дата начала занятий (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  starts_at?: string | null;

  @Field(() => Int, { nullable: true, description: 'Начало занятий через столько минут — только на стенде разработки со сжатым временем' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  starts_in_minutes?: number | null;

  @Field(() => String, { nullable: true, description: 'Привязка к площадке' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  external_ref?: string | null;

  @Field(() => Boolean, { nullable: true, description: 'Набор в группу открыт' })
  @IsOptional()
  @IsBoolean()
  enrollment_open?: boolean | null;
}
