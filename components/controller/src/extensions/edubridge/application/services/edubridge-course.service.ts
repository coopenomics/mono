import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { EduCourseStatus } from '../../domain/enums';
import type { EdubridgeCourseEntity } from '../../infrastructure/entities';
import { EdubridgeCourseRepository, type EduCourseFilter } from '../../infrastructure/repositories/edubridge-course.repository';
import type { EduCatalogSubjectDTO, EduCourseInputDTO, EduUpdateCourseInputDTO } from '../dto/edu-course.dto';

@Injectable()
export class EdubridgeCourseService {
  constructor(private readonly courses: EdubridgeCourseRepository) {}

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

  create(coopname: string, input: EduCourseInputDTO): Promise<EdubridgeCourseEntity> {
    const entity = this.courses.create({
      coopname,
      ...this.fields(input),
      status: EduCourseStatus.DRAFT,
    });
    return this.courses.save(entity);
  }

  async update(coopname: string, input: EduUpdateCourseInputDTO): Promise<EdubridgeCourseEntity> {
    const course = await this.get(coopname, input.id);
    Object.assign(course, this.fields(input));
    // Привязка к площадке изменилась — прежняя сверка больше не действительна.
    if (input.external_ref !== undefined && input.external_ref !== course.external_ref) course.external_title_seen = null;
    return this.courses.save(course);
  }

  async setStatus(coopname: string, id: string, status: EduCourseStatus): Promise<EdubridgeCourseEntity> {
    const course = await this.get(coopname, id);
    course.status = status;
    return this.courses.save(course);
  }

  private fields(input: EduCourseInputDTO): Partial<EdubridgeCourseEntity> {
    return {
      title: input.title,
      subject: input.subject.trim(),
      grade: input.grade.trim(),
      description: input.description ?? '',
      syllabus: input.syllabus ?? '',
      schedule: input.schedule ?? '',
      teacher_username: input.teacher_username ?? null,
      fee_month: input.fee_month,
      fee_year: input.fee_year,
      direction: input.direction,
      carrier: input.carrier,
      external_ref: input.external_ref ?? '',
      sort_order: input.sort_order ?? 0,
    };
  }
}
