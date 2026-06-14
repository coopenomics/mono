import { KuTrustRequestDomainEntity } from '../../domain/entities/ku-trust-request.entity';
import type { KuTrustRequestTypeormEntity } from '../entities/ku-trust-request.typeorm-entity';
import type {
  IKuTrustRequestBlockchainData,
  IKuTrustRequestDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';

/**
 * Маппер между доменной сущностью заявки доверенного и TypeORM-сущностью
 */
export class KuTrustRequestMapper {
  static toDomain(entity: KuTrustRequestTypeormEntity): KuTrustRequestDomainEntity {
    const databaseData: IKuTrustRequestDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: IKuTrustRequestBlockchainData | undefined;

    if (entity.hash) {
      blockchainData = {
        id: entity.id,
        hash: entity.hash,
        coopname: entity.coopname,
        braname: entity.braname,
        username: entity.username,
        application: entity.application as IKuTrustRequestBlockchainData['application'],
        authority: entity.authority as IKuTrustRequestBlockchainData['authority'],
      };
    }

    return new KuTrustRequestDomainEntity(databaseData, blockchainData);
  }

  static toEntity(domain: KuTrustRequestDomainEntity): Partial<KuTrustRequestTypeormEntity> {
    return {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status as string,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
      id: domain.id as number,
      hash: domain.hash as string,
      coopname: domain.coopname as string,
      braname: domain.braname as string,
      username: domain.username as string,
      application: domain.application as object,
      authority: domain.authority as object,
    };
  }

  static toUpdateEntity(domain: Partial<KuTrustRequestDomainEntity>): Partial<KuTrustRequestTypeormEntity> {
    const updateData: Partial<KuTrustRequestTypeormEntity> = {};

    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;
    if (domain.application !== undefined) updateData.application = domain.application as object;
    if (domain.authority !== undefined) updateData.authority = domain.authority as object;

    return updateData;
  }
}
