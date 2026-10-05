import { TableStore } from '@coopenomics/extension-kit';
import { EDUBRIDGE_RETURN_REQUEST_STORE } from '../database/edubridge-stores';
import { Inject, Injectable } from '@nestjs/common';
import { EduReturnStatus } from '../../domain/enums';
import { EdubridgeReturnRequestRecord } from '../entities';

/** Заявки на возврат остатка кошелька программы в паевой взнос. */
@Injectable()
export class EdubridgeReturnRequestKyselyRepository {
  constructor(@Inject(EDUBRIDGE_RETURN_REQUEST_STORE) private readonly repo: TableStore<EdubridgeReturnRequestRecord>) {}

  create(data: Partial<EdubridgeReturnRequestRecord>): EdubridgeReturnRequestRecord {
    return this.repo.create(data);
  }

  save(entity: EdubridgeReturnRequestRecord): Promise<EdubridgeReturnRequestRecord> {
    return this.repo.save(entity);
  }

  findById(coopname: string, id: string): Promise<EdubridgeReturnRequestRecord | null> {
    return this.repo.findOne({ coopname, id });
  }

  findByMember(coopname: string, member: string): Promise<EdubridgeReturnRequestRecord[]> {
    return this.repo.find({ coopname, member_username: member }, { order: { created_at: 'DESC' } });
  }

  findByStatus(coopname: string, status?: EduReturnStatus): Promise<EdubridgeReturnRequestRecord[]> {
    return this.repo.find({ coopname, ...(status ? { status } : {}) }, { order: { created_at: 'DESC' } });
  }
}
