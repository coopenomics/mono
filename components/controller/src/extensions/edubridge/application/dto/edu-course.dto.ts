import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { createPaginationResult } from '@coopenomics/extension-kit';
import { feeForMonths } from '../../domain/economy/course-fee.calculator';
import { EduAccessCarrier, EduCourseDirection, EduCourseStatus } from '../../domain/enums';
import type { EdubridgeCourseRecord } from '../../infrastructure/entities';
import type { EduCourseImage } from '../../infrastructure/entities/edubridge-course.record';
import { EduScheduleSlotDTO, EduScheduleSlotInputDTO } from './edu-schedule.dto';
import './edu-enums.registration';
import { exactLessonsPerMonth, round2 } from '../../domain/lib/schedule';

/** Раздел и уровень курса из справочника: ссылки и названия для показа. */
function taxonomyOf(e: EdubridgeCourseRecord) {
  return {
    section_id: e.section_id ?? null,
    section_title: e.section?.title ?? '',
    level_id: e.level_id ?? null,
    level_title: e.level?.title ?? '',
  };
}

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

  @Field(() => ID, { nullable: true, description: 'Раздел каталога из справочника' })
  section_id!: string | null;

  @Field(() => String, { description: 'Раздел каталога — область знаний: «Математика», «Духовные практики»' })
  section_title!: string;

  @Field(() => ID, { nullable: true, description: 'Уровень внутри раздела из справочника; пусто — без уровня' })
  level_id!: string | null;

  @Field(() => String, { description: 'Уровень внутри раздела: «7 класс», «Ступень 1»; пусто — без уровня' })
  level_title!: string;

  @Field(() => String, { description: 'Описание курса' })
  description!: string;

  @Field(() => String, { description: 'Учебная программа' })
  syllabus!: string;

  @Field(() => String, { description: 'Расписание занятий' })
  schedule!: string;

  @Field(() => [EduScheduleSlotDTO], { description: 'Окна расписания курса — образец для его групп' })
  schedule_slots!: EduScheduleSlotDTO[];

  @Field(() => Int, { description: 'Срок на отчёт преподавателя о занятии, дней после занятия' })
  report_days!: number;

  /** Ключ обложки в bucket'е; ссылку `image_url` подписывает резолвер поля. */
  image_record: EduCourseImage | null = null;

  @Field(() => String, { nullable: true, description: 'Обложка курса — подписанная ссылка с ограниченным сроком; null — без изображения' })
  image_url!: string | null;

  @Field(() => [String], { description: 'Преподаватели курса (учётные имена пайщиков)' })
  teacher_usernames!: string[];

  @Field(() => Float, { description: 'Занятий в месяц по окнам расписания: окон недели на 52/12 — для показа' })
  lessons_per_month!: number;

  @Field(() => Float, { description: 'Занятий во всей программе курса — для показа; ноль — программа без конца' })
  lessons_total!: number;

  @Field(() => Int, { description: 'Длительность занятия по первому окну расписания, минут' })
  lesson_minutes!: number;

  @Field(() => Int, { description: 'Длительность программы, месяцев; ноль — программа без конца' })
  program_months!: number;

  @Field(() => Int, { description: 'Минут занятий в месяц по окнам расписания — по ним считается взнос' })
  minutes_per_month!: number;

  @Field(() => Int, { description: 'Минут занятий в программе; ноль — программа без конца' })
  minutes_total!: number;

  @Field(() => String, { nullable: true, description: 'Дата активации курса — с неё начинаются занятия' })
  starts_at!: string | null;

  @Field(() => String, { description: 'Членский взнос за месяц' })
  fee_month!: string;

  @Field(() => Int, { description: 'Длительность курса в месяцах; ноль — у курса нет конечной программы' })
  course_months!: number;

  @Field(() => String, { nullable: true, description: 'Членский взнос за весь курс разом; пусто — принимается только помесячный взнос' })
  fee_course!: string | null;

  @Field(() => String, { nullable: true, description: 'Сумма помесячных взносов за весь курс: полный взнос за программу; с ней сравнивается взнос разом. Пусто у курса без конечной программы' })
  fee_course_base!: string | null;

  @Field(() => String, { nullable: true, description: 'На сколько взнос разом меньше суммы помесячных' })
  course_discount_amount!: string | null;

  constructor(e: EdubridgeCourseRecord) {
    this.id = e.id;
    this.title = e.title;
    Object.assign(this, taxonomyOf(e));
    this.description = e.description;
    this.syllabus = e.syllabus;
    this.schedule = e.schedule;
    this.schedule_slots = (e.schedule_slots ?? []).map((s) => new EduScheduleSlotDTO(s));
    this.report_days = e.report_days ?? 7;
    this.image_record = e.image ?? null;
    this.teacher_usernames = e.teacher_usernames ?? [];
    this.starts_at = e.starts_at;
    this.fee_month = e.fee_month;
    Object.assign(this, programFieldsOf(e), courseFeeFieldsOf(e));
  }
}

/** Числа программы курса: занятия и минуты для показа, длительность в месяцах. */
function programFieldsOf(e: EdubridgeCourseRecord): Pick<EduCatalogCourseDTO, 'lessons_per_month' | 'lessons_total' | 'lesson_minutes' | 'program_months' | 'minutes_per_month' | 'minutes_total' | 'course_months'> {
  const months = e.program_months ?? 0;
  const lessons = exactLessonsPerMonth(e.schedule_slots ?? []);
  return {
    lessons_per_month: lessons,
    lessons_total: round2(lessons * months),
    lesson_minutes: e.lesson_minutes,
    program_months: months,
    minutes_per_month: e.minutes_per_month ?? 0,
    minutes_total: e.minutes_total ?? 0,
    course_months: months,
  };
}

/** Взнос за весь курс: разом со скидкой — когда кооператив его принимает; полный помесячный виден всегда. */
function courseFeeFieldsOf(e: EdubridgeCourseRecord): Pick<EduCatalogCourseDTO, 'fee_course' | 'fee_course_base' | 'course_discount_amount'> {
  const months = e.program_months ?? 0;
  if (months <= 0) return { fee_course: null, fee_course_base: null, course_discount_amount: null };
  // Взнос разом — месячный за месяцы курса со скидкой; тем же расчётом его берёт подписка.
  const full = e.course_payment_enabled ? feeForMonths(e.fee_month, months, e.course_discount_bp / 100) : null;
  return { fee_course: full?.amount ?? null, fee_course_base: feeForMonths(e.fee_month, months, 0).base, course_discount_amount: full?.discount ?? null };
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

  @Field(() => String, { description: 'Плановая ставка часа — среднее по окнам расписания; стоимость занятия задаётся окном' })
  planned_hourly_rate!: string;

  @Field(() => Boolean, { description: 'Взнос преподавателя за занятие считается за каждого участника; иначе фиксированный за занятие' })
  pay_per_learner!: boolean;

  @Field(() => Boolean, { description: 'Принимает ли кооператив взнос за весь курс разом' })
  course_payment_enabled!: boolean;

  @Field(() => Float, { description: 'Скидка за взнос разом за весь курс, проценты' })
  course_discount_percent!: number;

  @Field(() => Int, { description: 'Гарантийный срок на материалы занятия, дней' })
  guarantee_days!: number;

  @Field(() => EduCourseStatus, { description: 'Состояние курса' })
  status!: EduCourseStatus;

  @Field(() => Int, { description: 'Порядок в каталоге' })
  sort_order!: number;

  @Field(() => Date, { description: 'Создан' })
  created_at!: Date;

  @Field(() => Date, { description: 'Изменён' })
  updated_at!: Date;

  constructor(e: EdubridgeCourseRecord) {
    super(e);
    this.direction = e.direction;
    this.carrier = e.carrier;
    this.external_ref = e.external_ref;
    this.external_title_seen = e.external_title_seen;
    this.planned_hourly_rate = e.planned_hourly_rate;
    this.pay_per_learner = Boolean(e.pay_per_learner);
    this.course_payment_enabled = e.course_payment_enabled;
    this.course_discount_percent = e.course_discount_bp / 100;
    this.guarantee_days = e.guarantee_days;
    this.status = e.status;
    this.sort_order = e.sort_order;
    this.created_at = e.created_at;
    this.updated_at = e.updated_at;
  }
}

@InputType('EduCatalogFilterInput')
export class EduCatalogFilterInputDTO {
  @Field(() => ID, { nullable: true, description: 'Раздел каталога из справочника' })
  @IsOptional()
  @IsUUID()
  section_id?: string;

  @Field(() => ID, { nullable: true, description: 'Уровень внутри раздела из справочника' })
  @IsOptional()
  @IsUUID()
  level_id?: string;

  @Field(() => String, { nullable: true, description: 'Название уровня — отбор по уровню сразу во всех разделах каталога' })
  @IsOptional()
  @IsString()
  level_title?: string;
}

@InputType('EduCoursesFilterInput')
export class EduCoursesFilterInputDTO extends EduCatalogFilterInputDTO {
  @Field(() => EduCourseStatus, { nullable: true, description: 'Состояние курса' })
  @IsOptional()
  @IsEnum(EduCourseStatus)
  status?: EduCourseStatus;
}

/**
 * Обложка курса в мутации: новое изображение — `base64` + `mime_type`;
 * оставить прежнее — `bucket_key`. Как у изображений товара «Стола заказов».
 */
@InputType('EduCourseImageUploadInput')
export class EduCourseImageUploadInputDTO {
  @Field(() => String, { nullable: true, description: 'Содержимое нового изображения в base64' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  base64?: string;

  @Field(() => String, { nullable: true, description: 'MIME-тип нового изображения: image/jpeg, image/png или image/webp' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mime_type?: string;

  @Field(() => String, { nullable: true, description: 'Ключ уже сохранённого изображения — оставить его' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bucket_key?: string;
}

@InputType('EduCourseInput')
export class EduCourseInputDTO {
  @Field(() => String, { description: 'Название курса' })
  @IsString()
  @Length(1, 255)
  title!: string;

  @Field(() => ID, { description: 'Раздел каталога из справочника' })
  @IsUUID()
  section_id!: string;

  @Field(() => ID, { nullable: true, description: 'Уровень внутри раздела из справочника; пусто — без уровня' })
  @IsOptional()
  @IsUUID()
  level_id?: string | null;

  @Field(() => String, { nullable: true, description: 'Описание курса' })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => String, { nullable: true, description: 'Учебная программа' })
  @IsOptional()
  @IsString()
  syllabus?: string;

  @Field(() => String, { nullable: true, description: 'Расписание строкой — когда окна расписания не заданы' })
  @IsOptional()
  @IsString()
  schedule?: string;

  @Field(() => [EduScheduleSlotInputDTO], { nullable: true, description: 'Окна расписания: день недели, время начала, длительность, преподаватель; образец для групп курса' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EduScheduleSlotInputDTO)
  schedule_slots?: EduScheduleSlotInputDTO[] | null;

  @Field(() => Int, { nullable: true, description: 'Срок на отчёт преподавателя о занятии, дней после занятия' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  report_days?: number | null;

  @Field(() => EduCourseImageUploadInputDTO, { nullable: true, description: 'Обложка курса: новое изображение (base64, ≤ 10 МБ, JPEG/PNG/WEBP), прежнее (bucket_key) или null — убрать' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EduCourseImageUploadInputDTO)
  image?: EduCourseImageUploadInputDTO | null;

  @Field(() => [String], { nullable: true, description: 'Преподаватели курса — из пайщиков с подписанным договором участия в хозяйственной деятельности' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teacher_usernames?: string[] | null;

  // Взносы за месяц и за весь курс считает сервер: часы занятий по ставке плюс
  // наценка кооператива. Произвольная сумма курса разошлась бы с обязательствами
  // перед преподавателями, поэтому во входных данных её нет.
  @Field(() => Int, { description: 'Длительность программы, месяцев; ноль — программа без конца' })
  @IsInt()
  @Min(0)
  @Max(120)
  program_months!: number;


  @Field(() => Boolean, { nullable: true, description: 'Взнос преподавателя за занятие считается за каждого участника; иначе фиксированный за занятие' })
  @IsOptional()
  @IsBoolean()
  pay_per_learner?: boolean;

  @Field(() => Int, { nullable: true, description: 'Гарантийный срок на материалы занятия, дней' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  guarantee_days?: number;

  @Field(() => String, { nullable: true, description: 'Дата активации курса (YYYY-MM-DD); пусто — дата ещё не назначена' })
  @IsOptional()
  @IsDateString()
  starts_at?: string | null;

  @Field(() => Int, { nullable: true, description: 'Начало занятий первой группы нового курса через столько минут — только на стенде разработки со сжатым временем' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  starts_in_minutes?: number | null;

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

  @Field(() => String, { description: 'ФИО преподавателя; пусто, если сертификата нет' })
  display_name!: string;

  @Field(() => String, { description: 'Номер договора участия в хозяйственной деятельности' })
  contract_number!: string;

  @Field(() => Date, { description: 'Когда подписан договор' })
  signed_at!: Date;
}

/** Группа курса на площадке — набор, в который зачисляется обучающийся. */
@ObjectType('EduPlatformGroup')
export class EduPlatformGroupDTO {
  @Field(() => String, { description: 'Идентификатор группы на площадке' })
  id!: string;

  @Field(() => String, { description: 'Название группы' })
  name!: string;
}

/** Курс на образовательной площадке кооператива — то, к чему привязывается курс каталога. */
@ObjectType('EduPlatformCourse')
export class EduPlatformCourseDTO {
  @Field(() => String, { description: 'Идентификатор курса на площадке (для Skillspace — UUID)' })
  id!: string;

  @Field(() => String, { description: 'Название курса на площадке' })
  name!: string;

  @Field(() => [EduPlatformGroupDTO], { description: 'Группы курса; пустой список — зачисление на курс напрямую' })
  groups!: EduPlatformGroupDTO[];
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
