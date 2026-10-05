import { Inject, Injectable } from '@nestjs/common';
import { TableStore, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_LEARNER_STORE } from '../database/edubridge-stores';
import { EdubridgeLearnerEntity } from '../entities';

@Injectable()
export class EdubridgeLearnerRepository {
  constructor(@Inject(EDUBRIDGE_LEARNER_STORE) private readonly repo: TableStore<EdubridgeLearnerEntity>) {}

  findByMember(coopname: string, member: string): Promise<EdubridgeLearnerEntity[]> {
    return this.repo.find({ coopname, member_username: member }, { order: { created_at: 'ASC' } });
  }

  findById(coopname: string, id: string): Promise<EdubridgeLearnerEntity | null> {
    return this.repo.findOne({ coopname, id });
  }

  findByIds(coopname: string, ids: string[]): Promise<EdubridgeLearnerEntity[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({ coopname, id: oneOf(ids) });
  }

  create(data: Partial<EdubridgeLearnerEntity>): EdubridgeLearnerEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeLearnerEntity): Promise<EdubridgeLearnerEntity> {
    return this.repo.save(entity);
  }

  async remove(entity: EdubridgeLearnerEntity): Promise<EdubridgeLearnerEntity> {
    await this.repo.delete({ id: entity.id });
    return entity;
  }
}
