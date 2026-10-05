import { TableStore } from '@coopenomics/extension-kit';
import { EDUBRIDGE_LESSON_STORE } from '../database/edubridge-stores';
import { Inject, Injectable } from '@nestjs/common';
import { EdubridgeLessonRecord } from '../entities';

/** Журнал занятий курса: что проведено, кем и с какими материалами. */
@Injectable()
export class EdubridgeLessonKyselyRepository {
  constructor(@Inject(EDUBRIDGE_LESSON_STORE) private readonly repo: TableStore<EdubridgeLessonRecord>) {}

  findByCourse(coopname: string, courseId: string): Promise<EdubridgeLessonRecord[]> {
    return this.repo.find({ coopname, course_id: courseId }, { order: { lesson_number: 'ASC' } });
  }

  findByTeacher(coopname: string, teacher: string): Promise<EdubridgeLessonRecord[]> {
    return this.repo.find({ coopname, teacher_username: teacher }, { order: { held_at: 'DESC' } });
  }

  findByNumber(coopname: string, courseId: string, lessonNumber: number): Promise<EdubridgeLessonRecord | null> {
    return this.repo.findOne({ coopname, course_id: courseId, lesson_number: lessonNumber });
  }

  findById(coopname: string, id: string): Promise<EdubridgeLessonRecord | null> {
    return this.repo.findOne({ coopname, id });
  }

  create(data: Partial<EdubridgeLessonRecord>): EdubridgeLessonRecord {
    return this.repo.create(data);
  }

  save(entity: EdubridgeLessonRecord): Promise<EdubridgeLessonRecord> {
    return this.repo.save(entity);
  }
}
