import { Inject, Injectable } from '@nestjs/common';
import { TableStore, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_LEARNER_STORE } from '../database/edubridge-stores';
import { EdubridgeLearnerRecord } from '../entities';

@Injectable()
export class EdubridgeLearnerKyselyRepository {
  constructor(@Inject(EDUBRIDGE_LEARNER_STORE) private readonly repo: TableStore<EdubridgeLearnerRecord>) {}

  findByMember(coopname: string, member: string): Promise<EdubridgeLearnerRecord[]> {
    return this.repo.find({ coopname, member_username: member }, { order: { created_at: 'ASC' } });
  }

  findById(coopname: string, id: string): Promise<EdubridgeLearnerRecord | null> {
    return this.repo.findOne({ coopname, id });
  }

  findByIds(coopname: string, ids: string[]): Promise<EdubridgeLearnerRecord[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({ coopname, id: oneOf(ids) });
  }

  create(data: Partial<EdubridgeLearnerRecord>): EdubridgeLearnerRecord {
    return this.repo.create(data);
  }

  save(entity: EdubridgeLearnerRecord): Promise<EdubridgeLearnerRecord> {
    return this.repo.save(entity);
  }

  async remove(entity: EdubridgeLearnerRecord): Promise<EdubridgeLearnerRecord> {
    await this.repo.delete({ id: entity.id });
    return entity;
  }
}
