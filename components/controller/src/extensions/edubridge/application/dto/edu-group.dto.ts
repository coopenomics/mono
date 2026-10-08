import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { EduGroupStatus } from '../../domain/enums';
import type { EdubridgeGroupRecord } from '../../infrastructure/entities';

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
  @Field(() => String, { description: 'Членский взнос за месяц в группе' }) fee_month!: string;
  @Field(() => String, { description: 'Плановая ставка часа в группе' }) planned_hourly_rate!: string;
  @Field(() => Boolean, { description: 'Взнос преподавателя за занятие считается за каждого участника; иначе фиксированный за занятие' }) pay_per_learner!: boolean;
  @Field(() => Int, { description: 'Занятий в программе группы' }) lessons_total!: number;
  @Field(() => Int, { description: 'Гарантийный срок, дней' }) guarantee_days!: number;
  @Field(() => String, { nullable: true, description: 'Остаток резерва преподавателям по группе' }) teacher_reserve_balance!: string | null;
  @Field(() => String, { nullable: true, description: 'Выплачено преподавателям по группе' }) teacher_settled_total!: string | null;
  @Field(() => Int, { description: 'Участников с действующей подпиской' }) learners_active!: number;
  @Field(() => Int, { description: 'Проведено занятий' }) lessons_held!: number;
  @Field(() => Date) created_at!: Date;

  constructor(e: EdubridgeGroupRecord, counts: { learners_active: number; lessons_held: number } = { learners_active: 0, lessons_held: 0 }) {
    Object.assign(this, {
      id: e.id,
      course_id: e.course_id,
      title: e.title,
      status: e.status,
      enrollment_open: e.enrollment_open,
      external_ref: e.external_ref ?? '',
      starts_at: e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 10) : null,
      fee_month: e.fee_month,
      planned_hourly_rate: e.planned_hourly_rate,
      pay_per_learner: Boolean(e.pay_per_learner),
      lessons_total: e.lessons_total,
      guarantee_days: e.guarantee_days,
      teacher_reserve_balance: e.teacher_reserve_balance,
      teacher_settled_total: e.teacher_settled_total,
      created_at: e.created_at,
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
