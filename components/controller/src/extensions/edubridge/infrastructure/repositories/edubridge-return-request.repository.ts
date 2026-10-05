import { TableStore } from '@coopenomics/extension-kit';
import { EDUBRIDGE_RETURN_REQUEST_STORE } from '../database/edubridge-stores';
import { Inject, Injectable } from '@nestjs/common';
import { EduReturnStatus } from '../../domain/enums';
import { EdubridgeReturnRequestEntity } from '../entities';

/** Заявки на возврат остатка кошелька программы в паевой взнос. */
@Injectable()
export class EdubridgeReturnRequestRepository {
  constructor(@Inject(EDUBRIDGE_RETURN_REQUEST_STORE) private readonly repo: TableStore<EdubridgeReturnRequestEntity>) {}

  create(data: Partial<EdubridgeReturnRequestEntity>): EdubridgeReturnRequestEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeReturnRequestEntity): Promise<EdubridgeReturnRequestEntity> {
    return this.repo.save(entity);
  }

  findById(coopname: string, id: string): Promise<EdubridgeReturnRequestEntity | null> {
    return this.repo.findOne({ coopname, id });
  }

  findByMember(coopname: string, member: string): Promise<EdubridgeReturnRequestEntity[]> {
    return this.repo.find({ coopname, member_username: member }, { order: { created_at: 'DESC' } });
  }

  findByStatus(coopname: string, status?: EduReturnStatus): Promise<EdubridgeReturnRequestEntity[]> {
    return this.repo.find({ coopname, ...(status ? { status } : {}) }, { order: { created_at: 'DESC' } });
  }
}
