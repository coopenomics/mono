import { TableStore } from '@coopenomics/extension-kit';
import { EDUBRIDGE_LESSON_STORE } from '../database/edubridge-stores';
import { Inject, Injectable } from '@nestjs/common';
import { EdubridgeLessonEntity } from '../entities';

/** Журнал занятий курса: что проведено, кем и с какими материалами. */
@Injectable()
export class EdubridgeLessonRepository {
  constructor(@Inject(EDUBRIDGE_LESSON_STORE) private readonly repo: TableStore<EdubridgeLessonEntity>) {}

  findByCourse(coopname: string, courseId: string): Promise<EdubridgeLessonEntity[]> {
    return this.repo.find({ coopname, course_id: courseId }, { order: { lesson_number: 'ASC' } });
  }

  findByTeacher(coopname: string, teacher: string): Promise<EdubridgeLessonEntity[]> {
    return this.repo.find({ coopname, teacher_username: teacher }, { order: { held_at: 'DESC' } });
  }

  findByNumber(coopname: string, courseId: string, lessonNumber: number): Promise<EdubridgeLessonEntity | null> {
    return this.repo.findOne({ coopname, course_id: courseId, lesson_number: lessonNumber });
  }

  findById(coopname: string, id: string): Promise<EdubridgeLessonEntity | null> {
    return this.repo.findOne({ coopname, id });
  }

  create(data: Partial<EdubridgeLessonEntity>): EdubridgeLessonEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeLessonEntity): Promise<EdubridgeLessonEntity> {
    return this.repo.save(entity);
  }
}
