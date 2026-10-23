import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { EduScheduleSlot } from '../../domain/lib/schedule';

/** Окно расписания: день недели, время начала, длительность, стоимость часа преподавателя и преподаватель. */
@ObjectType('EduScheduleSlot')
export class EduScheduleSlotDTO {
  @Field(() => Int, { description: 'День недели: 1 — понедельник … 7 — воскресенье; 8 — резерв' }) weekday!: number;
  @Field(() => String, { description: 'Время начала «ЧЧ:ММ» по часовому поясу кооператива' }) time!: string;
  @Field(() => Int, { description: 'Длительность занятия, минут' }) minutes!: number;
  @Field(() => ID, { nullable: true, description: 'Допуск преподавателя, который ведёт занятия окна; пусто — преподаватель не назначен' }) assignment_id!: string | null;
  @Field(() => String, { description: 'Плановая стоимость часа преподавателя в окне («1000.0000 RUB»); членский взнос кооператива в неё не входит' }) hourly_rate!: string;

  constructor(s: EduScheduleSlot) {
    this.weekday = s.weekday;
    this.time = s.time;
    this.minutes = s.minutes;
    this.assignment_id = s.assignment_id ?? null;
    this.hourly_rate = s.hourly_rate ?? '';
  }
}

@InputType('EduScheduleSlotInput')
export class EduScheduleSlotInputDTO {
  @Field(() => Int, { description: 'День недели: 1 — понедельник … 7 — воскресенье; 8 — резерв для внеочередных занятий' })
  @IsInt()
  @Min(1)
  @Max(8)
  weekday!: number;

  @Field(() => String, { description: 'Время начала «ЧЧ:ММ» по часовому поясу кооператива; у резерва пусто' })
  @IsString()
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;

  @Field(() => Int, { description: 'Длительность занятия, минут' })
  @IsInt()
  @Min(5)
  @Max(1440)
  minutes!: number;

  @Field(() => ID, { nullable: true, description: 'Допуск преподавателя' })
  @IsOptional()
  @IsUUID()
  assignment_id?: string | null;

  @Field(() => String, { description: 'Плановая стоимость часа преподавателя в окне («1000.0000 RUB»); членский взнос кооператива в неё не входит' })
  @IsString()
  @Matches(/^\d+\.\d{4} [A-Z]{1,7}$/)
  hourly_rate!: string;
}

/** Окна расписания группы и срок на отчёт: календарь занятий перестраивается. */
@InputType('EduSetGroupScheduleInput')
export class EduSetGroupScheduleInputDTO {
  @Field(() => ID, { description: 'Группа' })
  @IsUUID()
  group_id!: string;

  @Field(() => [EduScheduleSlotInputDTO], { description: 'Окна расписания; пусто — занятия по расписанию из календаря снимаются' })
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => EduScheduleSlotInputDTO)
  slots!: EduScheduleSlotInputDTO[];

  @Field(() => Int, { nullable: true, description: 'Срок на отчёт преподавателя о занятии, дней после занятия' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  report_days?: number | null;
}

/** Занятие сверх расписания: дата, длительность, преподаватель. */
@InputType('EduPlanLessonInput')
export class EduPlanLessonInputDTO {
  @Field(() => ID, { description: 'Группа' })
  @IsUUID()
  group_id!: string;

  @Field(() => String, { description: 'Момент занятия' })
  @IsDateString()
  held_at!: string;

  @Field(() => Int, { nullable: true, description: 'Длительность, минут; пусто — длительность занятия курса' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  minutes?: number | null;

  @Field(() => ID, { nullable: true, description: 'Допуск преподавателя; пусто — преподаватель назначается позже' })
  @IsOptional()
  @IsUUID()
  assignment_id?: string | null;

  @Field(() => String, { nullable: true, description: 'Тема занятия' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  topic?: string | null;
}

/** Перенос запланированного занятия: что названо, то и меняется. */
@InputType('EduMoveLessonInput')
export class EduMoveLessonInputDTO {
  @Field(() => ID, { description: 'Занятие' })
  @IsUUID()
  lesson_id!: string;

  @Field(() => String, { nullable: true, description: 'Новый момент занятия' })
  @IsOptional()
  @IsDateString()
  held_at?: string | null;

  @Field(() => Int, { nullable: true, description: 'Длительность, минут' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  minutes?: number | null;

  @Field(() => ID, { nullable: true, description: 'Допуск преподавателя; пустая строка — снять преподавателя' })
  @IsOptional()
  @IsString()
  assignment_id?: string | null;

  @Field(() => String, { nullable: true, description: 'Тема занятия' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  topic?: string | null;
}

/** Отбор календаря: курс, группа, преподаватель, окно дат. */
@InputType('EduLessonCalendarFilter')
export class EduLessonCalendarFilterDTO {
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID() course_id?: string | null;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID() group_id?: string | null;
  @Field(() => String, { nullable: true, description: 'Учётное имя преподавателя' }) @IsOptional() @IsString() teacher_username?: string | null;
  @Field(() => String, { nullable: true, description: 'С какого момента' }) @IsOptional() @IsDateString() from?: string | null;
  @Field(() => String, { nullable: true, description: 'До какого момента' }) @IsOptional() @IsDateString() to?: string | null;
}
