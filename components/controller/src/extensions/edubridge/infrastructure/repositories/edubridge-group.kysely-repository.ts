import { TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { EDUBRIDGE_GROUP_STORE } from '../database/edubridge-stores';
import { EduGroupStatus } from '../../domain/enums';
import { EdubridgeGroupRecord } from '../entities';

/** Группы (наборы) курсов: у каждой свои условия, участники, занятия и учёт средств. */
@Injectable()
export class EdubridgeGroupKyselyRepository {
  constructor(@Inject(EDUBRIDGE_GROUP_STORE) private readonly repo: TableStore<EdubridgeGroupRecord>) {}

  findById(coopname: string, id: string): Promise<EdubridgeGroupRecord | null> {
    return this.repo.findOne({ coopname, id });
  }

  findByCourse(coopname: string, courseId: string): Promise<EdubridgeGroupRecord[]> {
    return this.repo.find({ coopname, course_id: courseId }, { order: { created_at: 'ASC' } });
  }

  /** Группы курса, в которые сейчас идёт набор. */
  findOpenByCourse(coopname: string, courseId: string): Promise<EdubridgeGroupRecord[]> {
    return this.repo.find({ coopname, course_id: courseId, status: EduGroupStatus.ACTIVE, enrollment_open: true }, { order: { created_at: 'ASC' } });
  }

  listAll(coopname: string): Promise<EdubridgeGroupRecord[]> {
    return this.repo.find({ coopname }, { order: { created_at: 'ASC' } });
  }

  create(data: Partial<EdubridgeGroupRecord>): EdubridgeGroupRecord {
    return this.repo.create(data);
  }

  save(entity: EdubridgeGroupRecord): Promise<EdubridgeGroupRecord> {
    return this.repo.save(entity);
  }
}
