import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { EduRidType } from '../../domain/enums';
import type { EdubridgeContributionRecord, EdubridgeGroupRecord, EdubridgeLessonRecord } from '../../infrastructure/entities';
import './edu-enums.registration';

/** Откуда собраны сведения о взносе: курс, группа и занятие, по которому он оформлен. */
export interface EduContributionBriefSource {
  course: { id: string; title: string } | null;
  group: EdubridgeGroupRecord | null;
  lesson: EdubridgeLessonRecord | null;
  teacherName: string;
}

/** Стоимость часа преподавателя в окне расписания, по которому прошло занятие. */
function slotRateOf(group: EdubridgeGroupRecord | null, lesson: EdubridgeLessonRecord | null): string | null {
  if (!group || !lesson) return null;
  return group.schedule_slots?.[lesson.slot_index]?.hourly_rate || null;
}

/**
 * Сведения о взносе результатом работы для вопроса совета: что передаётся
 * кооперативу, по какому курсу, группе и занятию, на какую сумму. Совет читает
 * их рядом с заявлением преподавателя.
 */
@ObjectType('EduContributionBrief')
export class EduContributionBriefDTO {
  @Field(() => String, { description: 'Ключ взноса в цепи' }) rid_hash!: string;
  @Field(() => String, { description: 'Преподаватель' }) teacher_username!: string;
  @Field(() => String, { description: 'Имя преподавателя' }) teacher_name!: string;
  @Field(() => ID, { nullable: true, description: 'Курс' }) course_id!: string | null;
  @Field(() => String, { description: 'Название курса' }) course_title!: string;
  @Field(() => String, { description: 'Название группы' }) group_title!: string;
  @Field(() => Int, { nullable: true, description: 'Номер занятия в программе' }) lesson_number!: number | null;
  @Field(() => String, { description: 'Тема занятия' }) lesson_topic!: string;
  @Field(() => Date, { nullable: true, description: 'Момент занятия' }) held_at!: Date | null;
  @Field(() => Int, { nullable: true, description: 'Длительность занятия, минут' }) duration_minutes!: number | null;
  @Field(() => Int, { nullable: true, description: 'Участников с оплаченным доступом, по которым проведён расчёт за занятие' }) learners_count!: number | null;
  @Field(() => String, { nullable: true, description: 'Стоимость часа преподавателя в окне расписания' }) hourly_rate!: string | null;
  @Field(() => String, { description: 'Сумма паевого взноса' }) amount!: string;
  @Field(() => EduRidType, { description: 'Тип результата интеллектуальной деятельности' }) rid_type!: EduRidType;
  @Field(() => String, { description: 'Описание результата' }) description!: string;
  @Field(() => [String], { description: 'Материалы занятия: ссылки на внешние хранилища' }) links!: string[];
  @Field(() => Date, { nullable: true, description: 'До какой даты материалы держались гарантийным сроком' }) hold_until!: Date | null;
  @Field(() => Date, { description: 'Когда преподаватель оформил взнос' }) created_at!: Date;

  constructor(c: EdubridgeContributionRecord, source: EduContributionBriefSource) {
    const { course, group, lesson } = source;
    this.rid_hash = c.rid_hash;
    this.teacher_username = c.teacher_username;
    this.teacher_name = source.teacherName;
    this.course_id = course ? course.id : null;
    this.course_title = course ? course.title : '';
    this.group_title = group ? group.title : '';
    this.hourly_rate = slotRateOf(group, lesson);
    this.amount = c.amount;
    this.rid_type = c.rid_type;
    this.description = c.description;
    this.links = c.links ?? [];
    this.hold_until = c.hold_until;
    this.created_at = c.created_at;
    this.applyLesson(lesson);
  }

  private applyLesson(lesson: EdubridgeLessonRecord | null): void {
    this.lesson_number = lesson ? lesson.lesson_number : null;
    this.lesson_topic = lesson ? lesson.topic : '';
    this.held_at = lesson ? lesson.held_at : null;
    this.duration_minutes = lesson ? lesson.duration_minutes : null;
    this.learners_count = lesson ? lesson.learners_count ?? null : null;
  }
}
