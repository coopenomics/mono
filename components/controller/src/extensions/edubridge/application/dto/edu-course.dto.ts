import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
import { createPaginationResult } from '@coopenomics/extension-kit';
import { EduAccessCarrier, EduCourseDirection, EduCourseStatus } from '../../domain/enums';
import type { EdubridgeCourseEntity } from '../../infrastructure/entities';
import './edu-enums.registration';

/** Сумма в формате цепи: «1000.0000 RUB». */
const ASSET_PATTERN = /^\d+\.\d{4} [A-Z]{1,7}$/;

/**
 * Карточка курса для посетителя каталога. Внутренних признаков (тип
 * направления, привязка к площадке, состояние) здесь нет намеренно.
 */
@ObjectType('EduCatalogCourse')
export class EduCatalogCourseDTO {
  @Field(() => ID, { description: 'Идентификатор курса' })
  id!: string;

  @Field(() => String, { description: 'Название курса' })
  title!: string;

  @Field(() => String, { description: 'Предмет' })
  subject!: string;

  @Field(() => String, { description: 'Класс' })
  grade!: string;

  @Field(() => String, { description: 'Описание курса' })
  description!: string;

  @Field(() => String, { description: 'Учебная программа' })
  syllabus!: string;

  @Field(() => String, { description: 'Расписание занятий' })
  schedule!: string;

  @Field(() => [String], { description: 'Преподаватели курса (учётные имена пайщиков)' })
  teacher_usernames!: string[];

  @Field(() => String, { description: 'Членский взнос за месяц' })
  fee_month!: string;

  @Field(() => String, { description: 'Членский взнос за год' })
  fee_year!: string;

  constructor(e: EdubridgeCourseEntity) {
    this.id = e.id;
    this.title = e.title;
    this.subject = e.subject;
    this.grade = e.grade;
    this.description = e.description;
    this.syllabus = e.syllabus;
    this.schedule = e.schedule;
    this.teacher_usernames = e.teacher_usernames ?? [];
    this.fee_month = e.fee_month;
    this.fee_year = e.fee_year;
  }
}

/** Курс для владельца и администратора — со всеми служебными полями. */
@ObjectType('EduCourse')
export class EduCourseDTO extends EduCatalogCourseDTO {
  @Field(() => EduCourseDirection, { description: 'Тип направления (внутренний признак)' })
  direction!: EduCourseDirection;

  @Field(() => EduAccessCarrier, { description: 'Носитель доступа' })
  carrier!: EduAccessCarrier;

  @Field(() => String, { description: 'Идентификатор курса на площадке' })
  external_ref!: string;

  @Field(() => String, { nullable: true, description: 'Название курса на площадке при последней сверке' })
  external_title_seen!: string | null;

  @Field(() => EduCourseStatus, { description: 'Состояние курса' })
  status!: EduCourseStatus;

  @Field(() => Int, { description: 'Порядок в каталоге' })
  sort_order!: number;

  @Field(() => Date, { description: 'Создан' })
  created_at!: Date;

  @Field(() => Date, { description: 'Изменён' })
  updated_at!: Date;

  constructor(e: EdubridgeCourseEntity) {
    super(e);
    this.direction = e.direction;
    this.carrier = e.carrier;
    this.external_ref = e.external_ref;
    this.external_title_seen = e.external_title_seen;
    this.status = e.status;
    this.sort_order = e.sort_order;
    this.created_at = e.created_at;
    this.updated_at = e.updated_at;
  }
}

@ObjectType('EduCatalogSubject')
export class EduCatalogSubjectDTO {
  @Field(() => String, { description: 'Предмет' })
  subject!: string;

  @Field(() => [String], { description: 'Классы, по которым есть курсы' })
  grades!: string[];
}

@InputType('EduCatalogFilterInput')
export class EduCatalogFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Предмет' })
  @IsOptional()
  @IsString()
  subject?: string;

  @Field(() => String, { nullable: true, description: 'Класс' })
  @IsOptional()
  @IsString()
  grade?: string;
}

@InputType('EduCoursesFilterInput')
export class EduCoursesFilterInputDTO extends EduCatalogFilterInputDTO {
  @Field(() => EduCourseStatus, { nullable: true, description: 'Состояние курса' })
  @IsOptional()
  @IsEnum(EduCourseStatus)
  status?: EduCourseStatus;
}

@InputType('EduCourseInput')
export class EduCourseInputDTO {
  @Field(() => String, { description: 'Название курса' })
  @IsString()
  @Length(1, 255)
  title!: string;

  @Field(() => String, { description: 'Предмет' })
  @IsString()
  @Length(1, 120)
  subject!: string;

  @Field(() => String, { description: 'Класс' })
  @IsString()
  @Length(1, 60)
  grade!: string;

  @Field(() => String, { nullable: true, description: 'Описание курса' })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => String, { nullable: true, description: 'Учебная программа' })
  @IsOptional()
  @IsString()
  syllabus?: string;

  @Field(() => String, { nullable: true, description: 'Расписание занятий' })
  @IsOptional()
  @IsString()
  schedule?: string;

  @Field(() => [String], { nullable: true, description: 'Преподаватели курса — из пайщиков с подписанным договором участия в хозяйственной деятельности' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teacher_usernames?: string[] | null;

  @Field(() => String, { description: 'Членский взнос за месяц («1000.0000 RUB»)' })
  @Matches(ASSET_PATTERN, { message: 'Сумма должна быть в формате «1000.0000 RUB»' })
  fee_month!: string;

  @Field(() => String, { description: 'Членский взнос за год («10000.0000 RUB»)' })
  @Matches(ASSET_PATTERN, { message: 'Сумма должна быть в формате «10000.0000 RUB»' })
  fee_year!: string;

  @Field(() => EduCourseDirection, { description: 'Тип направления' })
  @IsEnum(EduCourseDirection)
  direction!: EduCourseDirection;

  @Field(() => EduAccessCarrier, { description: 'Носитель доступа' })
  @IsEnum(EduAccessCarrier)
  carrier!: EduAccessCarrier;

  @Field(() => String, { nullable: true, description: 'Идентификатор курса на площадке' })
  @IsOptional()
  @IsString()
  external_ref?: string;

  @Field(() => Int, { nullable: true, description: 'Порядок в каталоге' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

/** Преподаватель, которого можно назначить на курс: пайщик с подписанным договором УХД. */
@ObjectType('EduTeacherOption')
export class EduTeacherOptionDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' })
  username!: string;

  @Field(() => String, { description: 'Номер договора участия в хозяйственной деятельности' })
  contract_number!: string;

  @Field(() => Date, { description: 'Когда подписан договор' })
  signed_at!: Date;
}

@InputType('EduUpdateCourseInput')
export class EduUpdateCourseInputDTO extends EduCourseInputDTO {
  @Field(() => ID, { description: 'Идентификатор курса' })
  @IsUUID()
  id!: string;
}

@InputType('EduSetCourseStatusInput')
export class EduSetCourseStatusInputDTO {
  @Field(() => ID, { description: 'Идентификатор курса' })
  @IsUUID()
  id!: string;

  @Field(() => EduCourseStatus, { description: 'Новое состояние' })
  @IsEnum(EduCourseStatus)
  status!: EduCourseStatus;
}

export const PaginatedEduCatalogCoursesDTO = createPaginationResult(EduCatalogCourseDTO, 'PaginatedEduCatalogCourses');
export const PaginatedEduCoursesDTO = createPaginationResult(EduCourseDTO, 'PaginatedEduCourses');
