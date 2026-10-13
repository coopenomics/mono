import { TableStore, oneOf, within } from '@coopenomics/extension-kit';
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

  /** Занятия группы: порядок отчётов и номера занятий ведутся внутри неё. */
  findByGroup(coopname: string, groupId: string): Promise<EdubridgeLessonRecord[]> {
    return this.repo.find({ coopname, group_id: groupId }, { order: { lesson_number: 'ASC' } });
  }

  findByGroupNumber(coopname: string, groupId: string, lessonNumber: number): Promise<EdubridgeLessonRecord | null> {
    return this.repo.findOne({ coopname, group_id: groupId, lesson_number: lessonNumber });
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

  /** Занятия кооператива за окно дат — календарь школы; отбор по группе и преподавателю — у вызывающего. */
  findInRange(coopname: string, from: Date, to: Date): Promise<EdubridgeLessonRecord[]> {
    return this.repo.find({ coopname, held_at: within(from, to) }, { order: { held_at: 'ASC' } });
  }

  /** Запланированные занятия из окон расписания стираются при перестройке календаря группы. */
  deleteMany(ids: string[]): Promise<number> {
    if (!ids.length) return Promise.resolve(0);
    return this.repo.delete({ id: oneOf(ids) });
  }

  create(data: Partial<EdubridgeLessonRecord>): EdubridgeLessonRecord {
    return this.repo.create(data);
  }

  save(entity: EdubridgeLessonRecord): Promise<EdubridgeLessonRecord> {
    return this.repo.save(entity);
  }
}
