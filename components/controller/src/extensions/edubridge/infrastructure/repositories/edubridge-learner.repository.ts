import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EdubridgeLearnerEntity } from '../entities';

@Injectable()
export class EdubridgeLearnerRepository {
  constructor(@InjectRepository(EdubridgeLearnerEntity) private readonly repo: Repository<EdubridgeLearnerEntity>) {}

  findByMember(coopname: string, member: string): Promise<EdubridgeLearnerEntity[]> {
    return this.repo.find({ where: { coopname, member_username: member }, order: { created_at: 'ASC' } });
  }

  findById(coopname: string, id: string): Promise<EdubridgeLearnerEntity | null> {
    return this.repo.findOne({ where: { coopname, id } });
  }

  findByIds(coopname: string, ids: string[]): Promise<EdubridgeLearnerEntity[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.createQueryBuilder('l').where('l.coopname = :coopname AND l.id IN (:...ids)', { coopname, ids }).getMany();
  }

  create(data: Partial<EdubridgeLearnerEntity>): EdubridgeLearnerEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeLearnerEntity): Promise<EdubridgeLearnerEntity> {
    return this.repo.save(entity);
  }

  remove(entity: EdubridgeLearnerEntity): Promise<EdubridgeLearnerEntity> {
    return this.repo.remove(entity);
  }
}
