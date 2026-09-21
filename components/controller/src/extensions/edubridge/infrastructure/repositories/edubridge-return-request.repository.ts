import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EduReturnStatus } from '../../domain/enums';
import { EdubridgeReturnRequestEntity } from '../entities';

/** Заявки на возврат остатка кошелька программы в паевой взнос. */
@Injectable()
export class EdubridgeReturnRequestRepository {
  constructor(@InjectRepository(EdubridgeReturnRequestEntity) private readonly repo: Repository<EdubridgeReturnRequestEntity>) {}

  create(data: Partial<EdubridgeReturnRequestEntity>): EdubridgeReturnRequestEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeReturnRequestEntity): Promise<EdubridgeReturnRequestEntity> {
    return this.repo.save(entity);
  }

  findById(coopname: string, id: string): Promise<EdubridgeReturnRequestEntity | null> {
    return this.repo.findOne({ where: { coopname, id } });
  }

  findByMember(coopname: string, member: string): Promise<EdubridgeReturnRequestEntity[]> {
    return this.repo.find({ where: { coopname, member_username: member }, order: { created_at: 'DESC' } });
  }

  findByStatus(coopname: string, status?: EduReturnStatus): Promise<EdubridgeReturnRequestEntity[]> {
    return this.repo.find({ where: { coopname, ...(status ? { status } : {}) }, order: { created_at: 'DESC' } });
  }
}
