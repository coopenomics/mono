import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { CARRIERS_BY_DIRECTION, EduAccessCarrier, EduCourseStatus, PLATFORM_CARRIERS } from '../../domain/enums';
import type { EdubridgeCourseEntity } from '../../infrastructure/entities';
import { EdubridgeCourseRepository, type EduCourseFilter } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeTeacherRepository } from '../../infrastructure/repositories/edubridge-teacher.repository';
import { SkillspaceConnector, splitSkillspaceRef } from '../../infrastructure/connectors/skillspace.connector';
import type { EduCatalogSubjectDTO, EduCourseInputDTO, EduPlatformCourseDTO, EduTeacherOptionDTO, EduUpdateCourseInputDTO } from '../dto/edu-course.dto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Привязка к площадке: у площадок с API идентификатор обязателен, у Skillspace
 * это UUID курса из реестра школы (и UUID группы, если она есть) — числовой
 * номер из адреса конструктора площадка не знает.
 */
function validatePlatformRef(carrier: EduAccessCarrier, ref: string): void {
  if (!PLATFORM_CARRIERS.includes(carrier)) return;
  if (!ref.trim()) throw new BadRequestException('Для площадки нужен идентификатор курса на площадке');
  if (carrier !== EduAccessCarrier.SKILLSPACE) return;
  const { course, group } = splitSkillspaceRef(ref);
  if (!UUID_PATTERN.test(course) || (group && !UUID_PATTERN.test(group))) {
    throw new BadRequestException('Для Skillspace нужен UUID курса из реестра школы (и UUID группы, если она есть) — числовой номер из адреса конструктора площадка не знает');
  }
}

@Injectable()
export class EdubridgeCourseService {
  constructor(
    private readonly courses: EdubridgeCourseRepository,
    private readonly teachers: EdubridgeTeacherRepository,
    private readonly skillspace: SkillspaceConnector
  ) {}

  /**
   * Курсы школы Skillspace с группами — конструктор курса выбирает привязку из
   * них, а не вводит руками: числовой номер из адреса конструктора в API не
   * существует, а UUID из адреса чаще всего принадлежит модулю, не курсу.
   */
  async platformCourses(carrier: EduAccessCarrier): Promise<EduPlatformCourseDTO[]> {
    if (carrier !== EduAccessCarrier.SKILLSPACE) return [];
    const [courses, groups] = await Promise.all([this.skillspace.listCourses(), this.skillspace.listGroups()]);
    return courses.map((c) => ({
      id: c.id,
      name: c.name,
      groups: groups.filter((g) => g.courseId === c.id).map((g) => ({ id: g.id, name: g.name })),
    }));
  }

  /** Кого можно назначить преподавателем курса: пайщики с подписанным договором УХД. */
  async teacherOptions(coopname: string): Promise<EduTeacherOptionDTO[]> {
    const contracts = await this.teachers.listContracts(coopname);
    return contracts.map((c) => ({ username: c.teacher_username, contract_number: c.contract_number, signed_at: c.signed_at }));
  }

  /** Витрина: только опубликованные. */
  catalog(coopname: string, filter: EduCourseFilter, options?: PaginationInputDTO): Promise<PaginationResult<EdubridgeCourseEntity>> {
    return this.courses.findPage(coopname, { ...filter, status: EduCourseStatus.PUBLISHED }, options);
  }

  async catalogCourse(coopname: string, id: string): Promise<EdubridgeCourseEntity> {
    const course = await this.courses.findById(coopname, id);
    if (!course || course.status !== EduCourseStatus.PUBLISHED) throw new NotFoundException('Курс не найден');
    return course;
  }

  async subjects(coopname: string): Promise<EduCatalogSubjectDTO[]> {
    const rows = await this.courses.listSubjects(coopname);
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const grades = map.get(r.subject) ?? [];
      grades.push(r.grade);
      map.set(r.subject, grades);
    }
    return [...map.entries()].map(([subject, grades]) => ({ subject, grades }));
  }

  list(coopname: string, filter: EduCourseFilter, options?: PaginationInputDTO): Promise<PaginationResult<EdubridgeCourseEntity>> {
    return this.courses.findPage(coopname, filter, options);
  }

  async get(coopname: string, id: string): Promise<EdubridgeCourseEntity> {
    const course = await this.courses.findById(coopname, id);
    if (!course) throw new NotFoundException('Курс не найден');
    return course;
  }

  async create(coopname: string, input: EduCourseInputDTO): Promise<EdubridgeCourseEntity> {
    await this.validate(coopname, input);
    const entity = this.courses.create({
      coopname,
      ...this.fields(input),
      status: EduCourseStatus.DRAFT,
    });
    return this.courses.save(entity);
  }

  async update(coopname: string, input: EduUpdateCourseInputDTO): Promise<EdubridgeCourseEntity> {
    const course = await this.get(coopname, input.id);
    await this.validate(coopname, input);
    Object.assign(course, this.fields(input));
    // Привязка к площадке изменилась — прежняя сверка больше не действительна.
    if (input.external_ref !== undefined && input.external_ref !== course.external_ref) {
      course.external_title_seen = null;
      course.external_checked_at = null;
    }
    return this.courses.save(course);
  }

  async setStatus(coopname: string, id: string, status: EduCourseStatus): Promise<EdubridgeCourseEntity> {
    const course = await this.get(coopname, id);
    course.status = status;
    return this.courses.save(course);
  }

  /**
   * Носитель обязан соответствовать направлению, идентификатор курса на площадке
   * имеет смысл только у площадок с API, а преподавать могут лишь пайщики с
   * подписанным договором — форма это подсказывает, сервер проверяет сам.
   */
  private async validate(coopname: string, input: EduCourseInputDTO): Promise<void> {
    if (!CARRIERS_BY_DIRECTION[input.direction].includes(input.carrier)) {
      throw new BadRequestException(`Носитель «${input.carrier}» недопустим для направления «${input.direction}»`);
    }
    validatePlatformRef(input.carrier, input.external_ref ?? '');
    await this.validateTeachers(coopname, input.teacher_usernames ?? []);
  }

  /** Преподавать могут только пайщики с подписанным договором УХД. */
  private async validateTeachers(coopname: string, teachers: string[]): Promise<void> {
    if (!teachers.length) return;
    const known = new Set((await this.teachers.listContracts(coopname)).map((c) => c.teacher_username));
    const strangers = teachers.filter((t) => !known.has(t));
    if (strangers.length) {
      throw new BadRequestException(`Нет договора участия в хозяйственной деятельности: ${strangers.join(', ')}`);
    }
  }

  private fields(input: EduCourseInputDTO): Partial<EdubridgeCourseEntity> {
    const platform = PLATFORM_CARRIERS.includes(input.carrier);
    return {
      title: input.title,
      subject: input.subject.trim(),
      grade: input.grade.trim(),
      description: input.description ?? '',
      syllabus: input.syllabus ?? '',
      schedule: input.schedule ?? '',
      teacher_usernames: input.teacher_usernames ?? [],
      fee_month: input.fee_month,
      fee_year: input.fee_year,
      direction: input.direction,
      carrier: input.carrier,
      external_ref: platform ? (input.external_ref ?? '').trim() : '',
      sort_order: input.sort_order ?? 0,
    };
  }
}
