import { UserAgreementDomainEntity } from '~/domain/wallet/entities/user-agreement-domain.entity';
import { UserAgreementRecord } from '../records/user-agreement.record';
import type { IUserAgreementDatabaseData } from '~/domain/wallet/interfaces/user-agreement-database.interface';
import type { IUserAgreementBlockchainData } from '~/domain/wallet/interfaces/user-agreement-blockchain.interface';

export class UserAgreementMapper {
  static toDomain(entity: UserAgreementRecord): UserAgreementDomainEntity {
    const databaseData: IUserAgreementDatabaseData = {
      _id: entity._id,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      block_num: entity.block_num,
      present: entity.present,
    };

    const blockchainData: IUserAgreementBlockchainData = {
      coopname: entity.coopname,
      username: entity.username,
      programs: entity.programs ?? [],
    };

    return new UserAgreementDomainEntity(databaseData, blockchainData);
  }

  static toEntity(domain: UserAgreementDomainEntity): UserAgreementRecord {
    const entity = new UserAgreementRecord();

    entity._id = (domain as any)._id;
    entity._created_at = (domain as any)._created_at || new Date();
    entity._updated_at = new Date();
    entity.block_num = domain.getBlockNum() || 0;
    entity.present = (domain as any).present !== false;

    entity.coopname = domain.coopname as string;
    entity.username = domain.username as string;
    entity.programs = domain.programs ?? [];

    return entity;
  }
}
